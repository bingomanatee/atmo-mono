/**
 * WorkerResponder - Production responder with injectable utilities
 * Can be tested with MSW and other mocking tools
 */

import type { Responder, TaskIdentifier, TaskResponse } from './Responder';
import type { TaskManager, TaskManagerEvent } from './TaskManager';
import { TASK_MANAGER_EVENTS } from './TaskManager';
import { filter } from 'rxjs';
import { v4 as uuid } from 'uuid';
import type { WorkerUtilities } from './WorkerUtilities';
import { createDefaultUtilities } from './WorkerUtilities';

export interface TaskHandler {
  (parameters: any, utilities: WorkerUtilities): Promise<any>;
}

export interface WorkerResponderConfig {
  name: string;
  taskHandlers?: Record<string, TaskHandler>;
  utilities?: WorkerUtilities; // Injectable for testing
  testMode?: boolean; // For testing scenarios
  requestReducer?: (taskId: string, parameters: Record<string, any>) => any; // Legacy support
  workerWindow?: Window; // Injectable window for worker communication
}

interface PendingTask {
  requestId: string;
  taskId: string;
  parameters: any;
}

interface WorkerScript {
  postMessage(message: any): void;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
  ): void;
  terminate?(): void;
}

export interface WorkerManifest {
  name: string;
  scriptUrl: string;
  tasks: string[]; // Array of task names this worker can handle
}

export class WorkerResponder implements Responder {
  private name: string;
  private id: string;
  private taskHandlers: Record<string, TaskHandler>;
  private utilities: WorkerUtilities;
  private requestManager?: TaskManager;
  private pendingTasks = new Map<string, PendingTask>(); // requestId -> task details
  private testMode: boolean;
  private requestReducer?: (
    taskId: string,
    parameters: Record<string, any>,
  ) => any;
  private workerWindow?: Window;
  private workerScripts = new Map<string, WorkerScript>(); // taskId -> worker script
  private completionListeners = new Map<
    string,
    (event: MessageEvent) => void
  >(); // requestId -> listener

  constructor(config: WorkerResponderConfig) {
    this.name = config.name;
    this.id = uuid(); // Generate unique ID for this responder instance
    this.taskHandlers = config.taskHandlers || {};
    this.utilities = config.utilities || createDefaultUtilities();
    this.testMode = config.testMode || false;
    this.requestReducer = config.requestReducer;
    this.workerWindow = config.workerWindow;

    this.utilities.logger.info(
      `🏭 WorkerResponder '${this.name}' (${this.id}) initialized${this.testMode ? ' (TEST MODE)' : ''}`,
    );
  }

  // ─── Responder Interface Implementation ────────────────────────────

  async attachRequestManager(manager: TaskManager): Promise<void> {
    this.requestManager = manager;
    this.setupEventListeners();

    this.utilities.logger.info(
      `🔗 WorkerResponder '${this.name}' attached to RequestManager`,
    );
  }

  async perform(task: TaskIdentifier, payload: any): Promise<TaskResponse> {
    const handler = this.taskHandlers[task.name];
    if (!handler) {
      // Try legacy requestReducer if available
      if (this.requestReducer) {
        try {
          const output = this.requestReducer(task.name, payload);
          return { task, output };
        } catch (error) {
          return {
            task,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
      throw new Error(`No handler found for task: ${task.name}`);
    }

    try {
      this.utilities.logger.info(
        `🔄 WorkerResponder '${this.name}' performing task: ${task.name}`,
      );
      const output = await handler(payload, this.utilities);

      return {
        task,
        output,
      };
    } catch (error) {
      this.utilities.logger.error(
        `❌ WorkerResponder '${this.name}' task failed: ${task.name}`,
        error,
      );

      return {
        task,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Confirm method for explicit confirmation of task processing
   * This aligns with the confirm signature mentioned by the user
   */
  async confirm(
    requestId: string,
    taskId: string,
    parameters: any,
  ): Promise<void> {
    this.utilities.logger.info(
      `✅ WorkerResponder '${this.name}' (${this.id}) confirming task: ${taskId} for request: ${requestId}`,
    );

    // Start processing the confirmed task
    await this.startProcessing(requestId, taskId, parameters);
  }

  // ─── Worker Script Communication ───────────────────────────────────

  /**
   * Send completion request to worker script
   */
  private sendCompletionRequest(
    requestId: string,
    taskId: string,
    parameters: any,
  ): void {
    const workerScript = this.workerScripts.get(taskId);
    if (!workerScript) {
      this.utilities.logger.warn(
        `⚠️ No worker script found for task: ${taskId}`,
      );
      return;
    }

    const message = {
      type: 'completion-request',
      requestId,
      taskId,
      parameters,
      timestamp: Date.now(),
    };

    this.utilities.logger.info(
      `📤 Sending completion request to worker script for task: ${taskId}`,
    );

    workerScript.postMessage(message);
  }

  /**
   * Listen for completion events from worker scripts
   */
  private setupWorkerCompletionListener(
    requestId: string,
    taskId: string,
  ): void {
    const workerScript = this.workerScripts.get(taskId);
    if (!workerScript) return;

    const listener = (event: MessageEvent) => {
      if (
        event.data?.type === 'completion-event' &&
        event.data?.requestId === requestId
      ) {
        this.handleWorkerCompletion(requestId, taskId, event.data);
      }
    };

    this.completionListeners.set(requestId, listener);
    workerScript.addEventListener('message', listener);

    this.utilities.logger.info(
      `👂 Set up completion listener for request: ${requestId}`,
    );
  }

  /**
   * Handle completion events from worker scripts
   */
  private handleWorkerCompletion(
    requestId: string,
    taskId: string,
    data: any,
  ): void {
    if (!this.requestManager) return;

    this.utilities.logger.info(
      `🎉 Received completion event for request: ${requestId}`,
    );

    // Clean up listener
    this.cleanupCompletionListener(requestId, taskId);

    if (data.success) {
      this.requestManager.completeRequest(requestId, data.result);
    } else {
      this.requestManager.failRequest(
        requestId,
        data.error || 'Worker script failed',
      );
    }
  }

  /**
   * Clean up completion listener
   */
  private cleanupCompletionListener(requestId: string, taskId: string): void {
    const listener = this.completionListeners.get(requestId);
    const workerScript = this.workerScripts.get(taskId);

    if (listener && workerScript) {
      workerScript.removeEventListener('message', listener);
      this.completionListeners.delete(requestId);

      this.utilities.logger.debug(
        `🧹 Cleaned up completion listener for request: ${requestId}`,
      );
    }
  }

  /**
   * Register a worker script for a specific task type
   */
  registerWorkerScript(taskId: string, workerScript: WorkerScript): void {
    this.workerScripts.set(taskId, workerScript);
    this.utilities.logger.info(
      `📝 Registered worker script for task: ${taskId}`,
    );
  }

  /**
   * Unregister a worker script
   */
  unregisterWorkerScript(taskId: string): void {
    const workerScript = this.workerScripts.get(taskId);
    if (workerScript && workerScript.terminate) {
      workerScript.terminate();
    }
    this.workerScripts.delete(taskId);
    this.utilities.logger.info(
      `🗑️ Unregistered worker script for task: ${taskId}`,
    );
  }

  // ─── Event Listeners ───────────────────────────────────────────────

  private setupEventListeners(): void {
    if (!this.requestManager) return;

    // Subscribe to REQUEST_SUBMITTED events to send claims
    this.requestManager
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

    // Subscribe to ALL REQUEST_CLAIM_CONFIRMED events (not filtered by responder ID)
    // We'll check if it's for us inside the handler
    this.requestManager
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
    if (!this.requestManager || !taskId) return;

    // Check if we can handle this task (handler, worker script, or legacy reducer)
    const handler = this.taskHandlers[taskId];
    const workerScript = this.workerScripts.get(taskId);
    const hasLegacyReducer = this.requestReducer;

    if (!handler && !workerScript && !hasLegacyReducer) {
      // We don't handle this task - ignore it, let other responders handle it
      this.utilities.logger.debug(
        `🤷 WorkerResponder '${this.name}' ignoring unknown task: ${taskId}`,
      );
      return;
    }

    // Store task details in pending map
    this.pendingTasks.set(requestId, {
      requestId,
      taskId,
      parameters: parameters || {},
    });

    // We can handle this task - send claim
    const handlerType = workerScript
      ? 'worker script'
      : handler
        ? 'task handler'
        : 'legacy reducer';
    this.utilities.logger.info(
      `📋 WorkerResponder '${this.name}' (${this.id}) claiming task: ${taskId} for request: ${requestId} (using ${handlerType})`,
    );
    this.requestManager.claimRequest(requestId, this.id);
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
        this.utilities.logger.info(
          `❌ WorkerResponder '${this.name}' (${this.id}) lost claim for task: ${task.taskId} to responder: ${confirmedResponderId}`,
        );
        this.pendingTasks.delete(requestId);
      }
      return;
    }

    // This confirmation is for us! Process the pending task
    const pendingTask = this.pendingTasks.get(requestId);
    if (!pendingTask) {
      this.utilities.logger.warn(
        `⚠️ WorkerResponder '${this.name}' (${this.id}) received confirmation for unknown request: ${requestId}`,
      );
      return;
    }

    // Remove from pending and start processing
    this.pendingTasks.delete(requestId);
    this.utilities.logger.info(
      `🎉 WorkerResponder '${this.name}' (${this.id}) won claim for task: ${pendingTask.taskId}`,
    );

    this.startProcessing(
      pendingTask.requestId,
      pendingTask.taskId,
      pendingTask.parameters,
    );
  }

  private async startProcessing(
    requestId: string,
    taskId: string,
    parameters: any,
  ): Promise<void> {
    if (!this.requestManager) return;

    // Check if we have a worker script for this task
    const workerScript = this.workerScripts.get(taskId);
    if (workerScript) {
      // Use worker script for processing
      this.utilities.logger.info(
        `🔄 WorkerResponder '${this.name}' (${this.id}) delegating to worker script for task: ${taskId}`,
      );

      this.setupWorkerCompletionListener(requestId, taskId);
      this.sendCompletionRequest(requestId, taskId, parameters);
      return;
    }

    // Check for task handler
    const handler = this.taskHandlers[taskId];
    if (!handler) {
      // Try legacy requestReducer if available
      if (this.requestReducer) {
        try {
          this.utilities.logger.info(
            `🔄 WorkerResponder '${this.name}' (${this.id}) using legacy reducer for task: ${taskId}`,
          );
          const result = this.requestReducer(taskId, parameters);
          this.requestManager.completeRequest(requestId, result);
          return;
        } catch (error) {
          this.requestManager.failRequest(
            requestId,
            error instanceof Error ? error.message : 'Legacy reducer failed',
          );
          return;
        }
      }

      // No handler found
      this.requestManager.failRequest(
        requestId,
        `No handler found for task: ${taskId}`,
      );
      return;
    }

    try {
      this.utilities.logger.info(
        `🔄 WorkerResponder '${this.name}' (${this.id}) confirmed and processing task: ${taskId}`,
      );

      const result = await handler(parameters, this.utilities);
      this.requestManager.completeRequest(requestId, result);

      this.utilities.logger.info(
        `✅ WorkerResponder '${this.name}' (${this.id}) completed task: ${taskId}`,
      );
    } catch (error) {
      this.utilities.logger.error(
        `❌ WorkerResponder '${this.name}' (${this.id}) failed task: ${taskId}`,
        error,
      );

      this.requestManager.failRequest(
        requestId,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
