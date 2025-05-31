/**
 * BrowserWorker - Specialized worker manager for browser environments
 * Manages multiple web workers based on manifests and handles task distribution
 */

import type { TaskManager, TaskManagerEvent } from './TaskManager';
import { TASK_MANAGER_EVENTS } from './TaskManager';
import type { Responder, TaskIdentifier, TaskResponse } from './Responder';
import { filter } from 'rxjs';
import { v4 as uuid } from 'uuid';

export interface WorkerManifest {
  name: string;
  scriptUrl: string;
  tasks: string[]; // Array of task names this worker can handle
}

interface ManagedWorker {
  id: string;
  name: string;
  worker: Worker;
  manifest: WorkerManifest;
  busy: boolean;
  currentTask?: string;
  tasksCompleted: number;
  lastActivity: number;
}

interface PendingTask {
  requestId: string;
  taskId: string;
  parameters: any;
  workerId?: string;
}

export interface BrowserWorkerConfig {
  name: string;
  window: Window;
  taskManager: TaskManager;
  workerManifests: WorkerManifest[];
  maxConcurrentTasks?: number;
  workerTimeout?: number; // Timeout for worker responses in ms
}

export class BrowserWorker implements Responder {
  private name: string;
  private id: string;
  private window: Window;
  private taskManager: TaskManager;
  private workerManifests: WorkerManifest[];
  private maxConcurrentTasks: number;
  private workerTimeout: number;
  
  private workers = new Map<string, ManagedWorker>(); // workerId -> worker
  private taskToWorkerMap = new Map<string, string[]>(); // taskName -> workerIds[]
  private pendingTasks = new Map<string, PendingTask>(); // requestId -> task details
  private completionListeners = new Map<string, (event: MessageEvent) => void>(); // requestId -> listener
  private workerTimeouts = new Map<string, NodeJS.Timeout>(); // requestId -> timeout

  constructor(config: BrowserWorkerConfig) {
    this.name = config.name;
    this.id = uuid();
    this.window = config.window;
    this.taskManager = config.taskManager;
    this.workerManifests = config.workerManifests;
    this.maxConcurrentTasks = config.maxConcurrentTasks || 4;
    this.workerTimeout = config.workerTimeout || 30000; // 30 seconds default

    console.log(`🌐 BrowserWorker '${this.name}' (${this.id}) initialized with ${this.workerManifests.length} worker manifests`);
    
    this.initializeWorkers();
    this.buildTaskToWorkerMap();
  }

  // ─── Responder Interface Implementation ────────────────────────────

  async attachRequestManager(manager: TaskManager): Promise<void> {
    // Already attached in constructor, but set up event listeners
    this.setupEventListeners();
    console.log(`🔗 BrowserWorker '${this.name}' attached to TaskManager`);
  }

  async perform(task: TaskIdentifier, payload: any): Promise<TaskResponse> {
    // This method is for direct task execution, but BrowserWorker works through the claim/confirm cycle
    const availableWorkers = this.getAvailableWorkersForTask(task.name);
    
    if (availableWorkers.length === 0) {
      return {
        task,
        error: `No available workers for task: ${task.name}`,
      };
    }

    const worker = availableWorkers[0];
    
    try {
      const result = await this.executeTaskOnWorker(worker, task.name, payload);
      return {
        task,
        output: result,
      };
    } catch (error) {
      return {
        task,
        error: error instanceof Error ? error.message : 'Worker execution failed',
      };
    }
  }

  // ─── Worker Management ─────────────────────────────────────────────

  private initializeWorkers(): void {
    for (const manifest of this.workerManifests) {
      try {
        const worker = new this.window.Worker(manifest.scriptUrl);
        const workerId = uuid();
        
        const managedWorker: ManagedWorker = {
          id: workerId,
          name: manifest.name,
          worker,
          manifest,
          busy: false,
          tasksCompleted: 0,
          lastActivity: Date.now(),
        };

        this.workers.set(workerId, managedWorker);
        
        // Set up basic worker event handlers
        worker.addEventListener('error', (error) => {
          console.error(`❌ Worker '${manifest.name}' error:`, error);
        });

        worker.addEventListener('messageerror', (error) => {
          console.error(`❌ Worker '${manifest.name}' message error:`, error);
        });

        console.log(`👷 Initialized worker '${manifest.name}' (${workerId}) for tasks: ${manifest.tasks.join(', ')}`);
      } catch (error) {
        console.error(`❌ Failed to initialize worker '${manifest.name}':`, error);
      }
    }
  }

  private buildTaskToWorkerMap(): void {
    for (const [workerId, worker] of this.workers) {
      for (const taskName of worker.manifest.tasks) {
        if (!this.taskToWorkerMap.has(taskName)) {
          this.taskToWorkerMap.set(taskName, []);
        }
        this.taskToWorkerMap.get(taskName)!.push(workerId);
      }
    }

    console.log(`🗺️ Built task-to-worker map for ${this.taskToWorkerMap.size} task types`);
  }

  private getAvailableWorkersForTask(taskName: string): ManagedWorker[] {
    const workerIds = this.taskToWorkerMap.get(taskName) || [];
    return workerIds
      .map(id => this.workers.get(id))
      .filter((worker): worker is ManagedWorker => worker !== undefined && !worker.busy);
  }

  // ─── Event Listeners ───────────────────────────────────────────────

  private setupEventListeners(): void {
    // Subscribe to REQUEST_SUBMITTED events to send claims
    this.taskManager
      .pipe(
        filter((event) => event.type === TASK_MANAGER_EVENTS.REQUEST_SUBMITTED),
      )
      .subscribe((event) => {
        this.handleRequestSubmitted(
          event.requestId,
          event.taskId,
          event.payload,
        );
      });

    // Subscribe to REQUEST_CLAIM_CONFIRMED events
    this.taskManager
      .pipe(
        filter(
          (event) => event.type === TASK_MANAGER_EVENTS.REQUEST_CLAIM_CONFIRMED,
        ),
      )
      .subscribe((event) => {
        this.handleClaimConfirmation(event.requestId, event.responderId);
      });
  }

  // ─── Claim Protocol Handlers ───────────────────────────────────────

  private handleRequestSubmitted(
    requestId: string,
    taskId?: string,
    parameters?: any,
  ): void {
    if (!taskId) return;

    const availableWorkers = this.getAvailableWorkersForTask(taskId);
    
    if (availableWorkers.length === 0) {
      // No available workers for this task
      console.log(`🤷 BrowserWorker '${this.name}' has no available workers for task: ${taskId}`);
      return;
    }

    // Store task details in pending map
    this.pendingTasks.set(requestId, {
      requestId,
      taskId,
      parameters: parameters || {},
    });

    // We can handle this task - send claim
    console.log(
      `📋 BrowserWorker '${this.name}' (${this.id}) claiming task: ${taskId} for request: ${requestId} (${availableWorkers.length} workers available)`,
    );
    this.taskManager.claimRequest(requestId, this.id);
  }

  private handleClaimConfirmation(
    requestId: string,
    confirmedResponderId?: string,
  ): void {
    // Check if this confirmation is for us
    if (confirmedResponderId !== this.id) {
      // Not for us - clean up any pending task for this request
      if (this.pendingTasks.has(requestId)) {
        const task = this.pendingTasks.get(requestId)!;
        console.log(
          `❌ BrowserWorker '${this.name}' (${this.id}) lost claim for task: ${task.taskId} to responder: ${confirmedResponderId}`,
        );
        this.pendingTasks.delete(requestId);
      }
      return;
    }

    // This confirmation is for us! Process the pending task
    const pendingTask = this.pendingTasks.get(requestId);
    if (!pendingTask) {
      console.warn(
        `⚠️ BrowserWorker '${this.name}' (${this.id}) received confirmation for unknown request: ${requestId}`,
      );
      return;
    }

    // Remove from pending and start processing
    this.pendingTasks.delete(requestId);
    console.log(
      `🎉 BrowserWorker '${this.name}' (${this.id}) won claim for task: ${pendingTask.taskId}`,
    );

    this.startProcessing(
      pendingTask.requestId,
      pendingTask.taskId,
      pendingTask.parameters,
    );
  }

  // ─── Task Processing ───────────────────────────────────────────────

  private async startProcessing(
    requestId: string,
    taskId: string,
    parameters: any,
  ): Promise<void> {
    const availableWorkers = this.getAvailableWorkersForTask(taskId);
    
    if (availableWorkers.length === 0) {
      this.taskManager.failRequest(
        requestId,
        `No available workers for task: ${taskId}`,
      );
      return;
    }

    // Select the first available worker (could implement load balancing here)
    const selectedWorker = availableWorkers[0];
    selectedWorker.busy = true;
    selectedWorker.currentTask = taskId;

    console.log(
      `🔄 BrowserWorker '${this.name}' (${this.id}) processing task: ${taskId} on worker: ${selectedWorker.name}`,
    );

    try {
      const result = await this.executeTaskOnWorker(selectedWorker, taskId, parameters, requestId);
      
      // Mark worker as available
      selectedWorker.busy = false;
      selectedWorker.currentTask = undefined;
      selectedWorker.tasksCompleted++;
      selectedWorker.lastActivity = Date.now();

      this.taskManager.completeRequest(requestId, result);

      console.log(
        `✅ BrowserWorker '${this.name}' (${this.id}) completed task: ${taskId} on worker: ${selectedWorker.name}`,
      );
    } catch (error) {
      // Mark worker as available
      selectedWorker.busy = false;
      selectedWorker.currentTask = undefined;
      selectedWorker.lastActivity = Date.now();

      console.error(
        `❌ BrowserWorker '${this.name}' (${this.id}) failed task: ${taskId} on worker: ${selectedWorker.name}`,
        error,
      );

      this.taskManager.failRequest(
        requestId,
        error instanceof Error ? error.message : 'Worker execution failed',
      );
    }
  }

  private executeTaskOnWorker(
    worker: ManagedWorker,
    taskId: string,
    parameters: any,
    requestId?: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Worker timeout for task: ${taskId}`));
      }, this.workerTimeout);

      const listener = (event: MessageEvent) => {
        if (event.data?.type === 'task-complete' && event.data?.taskId === taskId) {
          clearTimeout(timeoutId);
          worker.worker.removeEventListener('message', listener);
          
          if (requestId) {
            this.workerTimeouts.delete(requestId);
          }

          if (event.data.success) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data.error || 'Worker task failed'));
          }
        }
      };

      worker.worker.addEventListener('message', listener);
      
      if (requestId) {
        this.workerTimeouts.set(requestId, timeoutId);
      }

      // Send task to worker
      worker.worker.postMessage({
        type: 'execute-task',
        taskId,
        parameters,
        requestId,
        timestamp: Date.now(),
      });
    });
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Get status of all managed workers
   */
  getWorkerStatus(): Array<{
    id: string;
    name: string;
    busy: boolean;
    currentTask?: string;
    tasksCompleted: number;
    lastActivity: number;
    tasks: string[];
  }> {
    return Array.from(this.workers.values()).map(worker => ({
      id: worker.id,
      name: worker.name,
      busy: worker.busy,
      currentTask: worker.currentTask,
      tasksCompleted: worker.tasksCompleted,
      lastActivity: worker.lastActivity,
      tasks: worker.manifest.tasks,
    }));
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const worker of this.workers.values()) {
      worker.worker.terminate();
    }
    this.workers.clear();
    this.taskToWorkerMap.clear();
    this.pendingTasks.clear();
    
    // Clear any pending timeouts
    for (const timeout of this.workerTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.workerTimeouts.clear();

    console.log(`🛑 BrowserWorker '${this.name}' terminated all workers`);
  }
}
