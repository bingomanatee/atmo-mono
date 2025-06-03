/**
 * Worker Pool Manager for Parallel Platelet Generation
 * 
 * Manages a pool of web workers to process multiple plates in parallel,
 * with proper coordination and resource management.
 */

import { log } from '../utils/utils';
import type { WorkerMessage, WorkerResponse } from './types/worker-types';

export interface WorkerPoolOptions {
  maxWorkers?: number;
  workerScript?: string;
  timeout?: number;
}

export interface WorkerTask {
  id: string;
  plateId: string;
  planetRadius: number;
  resolution: number;
  universeId: string;
  dontClear: boolean;
  priority?: number;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
}

interface ActiveWorker {
  worker: Worker;
  id: number;
  busy: boolean;
  currentTask?: WorkerTask;
  startTime?: number;
}

export class WorkerPool {
  private workers: ActiveWorker[] = [];
  private taskQueue: WorkerTask[] = [];
  private maxWorkers: number;
  private workerScript: string;
  private timeout: number;
  private nextWorkerId = 0;
  private stats: WorkerPoolStats;
  private taskResolvers = new Map<string, {
    resolve: (result: WorkerResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor(options: WorkerPoolOptions = {}) {
    this.maxWorkers = options.maxWorkers || Math.min(navigator.hardwareConcurrency || 4, 8);
    this.workerScript = options.workerScript || '/packages/atmo-plates/src/workers/platelet-worker.js';
    this.timeout = options.timeout || 30000; // 30 seconds
    
    this.stats = {
      totalWorkers: 0,
      activeWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    };

    log(`🔧 WorkerPool: Initialized with max ${this.maxWorkers} workers`);
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    log(`🔧 WorkerPool: Creating ${this.maxWorkers} workers...`);
    
    for (let i = 0; i < this.maxWorkers; i++) {
      await this.createWorker();
    }
    
    log(`✅ WorkerPool: ${this.workers.length} workers ready`);
  }

  /**
   * Create a new worker
   */
  private async createWorker(): Promise<void> {
    try {
      const worker = new Worker(this.workerScript, { type: 'module' });
      const workerId = this.nextWorkerId++;
      
      const activeWorker: ActiveWorker = {
        worker,
        id: workerId,
        busy: false
      };

      // Set up worker message handling
      worker.onmessage = (e) => this.handleWorkerMessage(workerId, e.data);
      worker.onerror = (error) => this.handleWorkerError(workerId, error);

      this.workers.push(activeWorker);
      this.stats.totalWorkers++;
      
      log(`✅ WorkerPool: Created worker ${workerId}`);
    } catch (error) {
      log(`❌ WorkerPool: Failed to create worker: ${error}`);
      throw error;
    }
  }

  /**
   * Submit a task to the worker pool
   */
  async submitTask(task: WorkerTask): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      // Store the resolver for this task
      this.taskResolvers.set(task.id, { resolve, reject });
      
      // Add task to queue
      this.taskQueue.push(task);
      this.stats.queuedTasks++;
      
      log(`📝 WorkerPool: Queued task ${task.id} for plate ${task.plateId}`);
      
      // Try to assign the task immediately
      this.processQueue();
      
      // Set up timeout
      setTimeout(() => {
        if (this.taskResolvers.has(task.id)) {
          this.taskResolvers.delete(task.id);
          this.stats.failedTasks++;
          reject(new Error(`Task ${task.id} timed out after ${this.timeout}ms`));
        }
      }, this.timeout);
    });
  }

  /**
   * Submit multiple tasks in parallel
   */
  async submitBatch(tasks: WorkerTask[]): Promise<WorkerResponse[]> {
    log(`📦 WorkerPool: Submitting batch of ${tasks.length} tasks`);
    
    const promises = tasks.map(task => this.submitTask(task));
    return Promise.all(promises);
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    // Find available workers and assign tasks
    for (const worker of this.workers) {
      if (!worker.busy && this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        this.assignTaskToWorker(worker, task);
        this.stats.queuedTasks--;
      }
    }
  }

  /**
   * Assign a task to a specific worker
   */
  private assignTaskToWorker(activeWorker: ActiveWorker, task: WorkerTask): void {
    activeWorker.busy = true;
    activeWorker.currentTask = task;
    activeWorker.startTime = Date.now();
    this.stats.activeWorkers++;

    const message: WorkerMessage = {
      plateId: task.plateId,
      planetRadius: task.planetRadius,
      resolution: task.resolution,
      universeId: task.universeId,
      dontClear: task.dontClear,
      timestamp: Date.now()
    };

    log(`🚀 WorkerPool: Assigned task ${task.id} to worker ${activeWorker.id}`);
    activeWorker.worker.postMessage(message);
  }

  /**
   * Handle worker message responses
   */
  private handleWorkerMessage(workerId: number, response: WorkerResponse): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker || !worker.currentTask) {
      log(`⚠️ WorkerPool: Received message from unknown worker ${workerId}`);
      return;
    }

    const task = worker.currentTask;
    const resolver = this.taskResolvers.get(task.id);
    
    if (resolver) {
      this.taskResolvers.delete(task.id);
      
      if (response.success) {
        this.stats.completedTasks++;
        log(`✅ WorkerPool: Task ${task.id} completed by worker ${workerId}`);
        resolver.resolve(response);
      } else {
        this.stats.failedTasks++;
        log(`❌ WorkerPool: Task ${task.id} failed on worker ${workerId}: ${response.error}`);
        resolver.reject(new Error(response.error || 'Unknown worker error'));
      }
    }

    // Mark worker as available
    worker.busy = false;
    worker.currentTask = undefined;
    worker.startTime = undefined;
    this.stats.activeWorkers--;

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerId: number, error: ErrorEvent): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;

    log(`❌ WorkerPool: Worker ${workerId} error: ${error.message}`);

    if (worker.currentTask) {
      const resolver = this.taskResolvers.get(worker.currentTask.id);
      if (resolver) {
        this.taskResolvers.delete(worker.currentTask.id);
        this.stats.failedTasks++;
        resolver.reject(new Error(`Worker error: ${error.message}`));
      }
    }

    // Mark worker as available and process queue
    worker.busy = false;
    worker.currentTask = undefined;
    worker.startTime = undefined;
    this.stats.activeWorkers--;
    this.processQueue();
  }

  /**
   * Get current pool statistics
   */
  getStats(): WorkerPoolStats {
    return { ...this.stats };
  }

  /**
   * Terminate all workers and clean up
   */
  async terminate(): Promise<void> {
    log(`🔧 WorkerPool: Terminating ${this.workers.length} workers...`);
    
    for (const worker of this.workers) {
      worker.worker.terminate();
    }
    
    this.workers = [];
    this.taskQueue = [];
    this.taskResolvers.clear();
    
    this.stats = {
      totalWorkers: 0,
      activeWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    };
    
    log(`✅ WorkerPool: All workers terminated`);
  }

  /**
   * Check if the pool is busy
   */
  isBusy(): boolean {
    return this.stats.activeWorkers > 0 || this.stats.queuedTasks > 0;
  }

  /**
   * Wait for all current tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (!this.isBusy()) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }
}
