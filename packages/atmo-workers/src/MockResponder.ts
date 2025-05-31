/**
 * MockResponder - In-memory responder for testing scenarios
 */

import type { Responder, TaskIdentifier, TaskResponse } from './Responder';
import type { TaskManager } from './TaskManager';
import { TASK_MANAGER_EVENTS } from './TaskManager';
import { filter } from 'rxjs';
import { v4 as uuid } from 'uuid';

export interface MockResponderConfig {
  name: string;
  taskReducers: Record<string, (parameters: any) => any>;
}

interface PendingTask {
  requestId: string;
  taskId: string;
  parameters: any;
}

export class MockResponder implements Responder {
  private name: string;
  private id: string;
  private taskReducers: Record<string, (parameters: any) => any>;
  private requestManager?: TaskManager;
  private pendingTasks = new Map<string, PendingTask>(); // requestId -> task details

  constructor(config: MockResponderConfig) {
    this.name = config.name;
    this.id = uuid(); // Generate unique ID for this responder instance
    this.taskReducers = config.taskReducers;

    console.log(`🧪 MockResponder '${this.name}' (${this.id}) initialized`);
  }

  // ─── Responder Interface Implementation ────────────────────────────

  async attachRequestManager(manager: TaskManager): Promise<void> {
    this.requestManager = manager;
    this.setupEventListeners();
    console.log(`🔗 MockResponder '${this.name}' attached to RequestManager`);
  }

  async perform(task: TaskIdentifier, payload: any): Promise<TaskResponse> {
    const reducer = this.taskReducers[task.name];

    if (!reducer) {
      return {
        task,
        error: `No reducer found for task: ${task.name}`,
      };
    }

    try {
      const output = reducer(payload);
      return {
        task,
        output,
      };
    } catch (error) {
      return {
        task,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ─── Event Listeners ───────────────────────────────────────────────

  private setupEventListeners(): void {
    if (!this.requestManager) return;

    // Subscribe to REQUEST_READY events to send claims
    this.requestManager
      .pipe(filter((event) => event.type === TASK_MANAGER_EVENTS.REQUEST_READY))
      .subscribe((event) => {
        this.handleRequestReady(event.requestId, event.taskId, event.payload);
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

  private handleRequestReady(
    requestId: string,
    taskId?: string,
    parameters?: any,
  ): void {
    if (!this.requestManager || !taskId) return;

    // Check if we have a reducer for this task
    const reducer = this.taskReducers[taskId];
    if (!reducer) {
      // We don't handle this task - ignore it, let other responders handle it
      console.log(
        `🤷 MockResponder '${this.name}' ignoring unknown task: ${taskId}`,
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
    console.log(
      `📋 MockResponder '${this.name}' (${this.id}) claiming task: ${taskId} for request: ${requestId}`,
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
        console.log(
          `❌ MockResponder '${this.name}' (${this.id}) lost claim for task: ${task.taskId} to responder: ${confirmedResponderId}`,
        );
        this.pendingTasks.delete(requestId);
      }
      return;
    }

    // This confirmation is for us! Process the pending task
    const pendingTask = this.pendingTasks.get(requestId);
    if (!pendingTask) {
      console.log(
        `⚠️ MockResponder '${this.name}' (${this.id}) received confirmation for unknown request: ${requestId}`,
      );
      return;
    }

    // Remove from pending and start processing
    this.pendingTasks.delete(requestId);
    console.log(
      `🎉 MockResponder '${this.name}' (${this.id}) won claim for task: ${pendingTask.taskId}`,
    );

    this.startProcessing(
      pendingTask.requestId,
      pendingTask.taskId,
      pendingTask.parameters,
    );
  }

  private async startProcessing(
    requestId: string,
    taskId?: string,
    parameters?: any,
  ): Promise<void> {
    if (!this.requestManager || !taskId) return;

    const reducer = this.taskReducers[taskId];
    if (!reducer) {
      // This shouldn't happen since we only claim tasks we can handle
      this.requestManager.failRequest(
        requestId,
        `No reducer found for task: ${taskId}`,
      );
      return;
    }

    try {
      console.log(
        `🔄 MockResponder '${this.name}' (${this.id}) confirmed and processing task: ${taskId}`,
      );
      const result = reducer(parameters || {});
      this.requestManager.completeRequest(requestId, result);
    } catch (error) {
      this.requestManager.failRequest(
        requestId,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  // ─── Legacy Method (kept for compatibility) ────────────────────────

  private async processRequest(
    requestId: string,
    taskId?: string,
    parameters?: any,
  ): Promise<void> {
    // This method is now replaced by the claim protocol
    // Keeping for backward compatibility if needed
    await this.startProcessing(requestId, taskId, parameters);
  }
}
