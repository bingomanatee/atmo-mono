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
  taskHandlers: Record<string, TaskHandler>;
  utilities?: WorkerUtilities; // Injectable for testing
}

interface PendingTask {
  requestId: string;
  taskId: string;
  parameters: any;
}

export class WorkerResponder implements Responder {
  private name: string;
  private id: string;
  private taskHandlers: Record<string, TaskHandler>;
  private utilities: WorkerUtilities;
  private requestManager?: TaskManager;
  private pendingTasks = new Map<string, PendingTask>(); // requestId -> task details

  constructor(config: WorkerResponderConfig) {
    this.name = config.name;
    this.id = uuid(); // Generate unique ID for this responder instance
    this.taskHandlers = config.taskHandlers;
    this.utilities = config.utilities || createDefaultUtilities();

    this.utilities.logger.info(
      `🏭 WorkerResponder '${this.name}' (${this.id}) initialized`,
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

    // Check if we have a handler for this task
    const handler = this.taskHandlers[taskId];
    if (!handler) {
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
    this.utilities.logger.info(
      `📋 WorkerResponder '${this.name}' (${this.id}) claiming task: ${taskId} for request: ${requestId}`,
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

    const handler = this.taskHandlers[taskId];
    if (!handler) {
      // This shouldn't happen since we only claim tasks we can handle
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
