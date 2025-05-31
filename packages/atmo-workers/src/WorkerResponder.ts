/**
 * WorkerResponder - Specific implementation of Responder for worker-based processing
 */

import type { Responder, TaskIdentifier, TaskResponse } from './Responder';
import type { TaskManager } from './TaskManager';
import { TASK_MANAGER_EVENTS } from './TaskManager';
import type { Bank } from './data-models';

export interface WorkerResponderConfig {
  name: string;
  testMode?: boolean;
  requestReducer?: (taskId: string, parameters: Record<string, any>) => any;
}

export class WorkerResponder implements Responder {
  private name: string;
  private testMode: boolean;
  private requestReducer?: (
    taskId: string,
    parameters: Record<string, any>,
  ) => any;
  private requestManager?: TaskManager;

  constructor(config: WorkerResponderConfig) {
    this.name = config.name;
    this.testMode = config.testMode || false;
    this.requestReducer = config.requestReducer;

    console.log(`🚀 WorkerResponder '${this.name}' initialized`);
  }

  // ─── Responder Interface Implementation ────────────────────────────

  async attachRequestManager(manager: TaskManager): Promise<void> {
    this.requestManager = manager;
    this.setupEventListeners();
    console.log(`🔗 WorkerResponder '${this.name}' attached to RequestManager`);
  }

  async perform(task: TaskIdentifier, payload: any): Promise<TaskResponse> {
    if (!this.requestReducer) {
      return {
        task,
        error: 'No request reducer configured',
      };
    }

    try {
      const output = this.requestReducer(task.name, payload);
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

    // Subscribe to TaskManager events using RxJS
    this.requestManager.events$.subscribe((event) => {
      if (event.type === TASK_MANAGER_EVENTS.REQUEST_READY) {
        this.processRequest(event.requestId);
      }
    });
  }

  // ─── Processing Logic ──────────────────────────────────────────────

  private async processRequest(requestId: string): Promise<void> {
    if (!this.requestManager) return;

    if (this.testMode && this.requestReducer) {
      // Use test reducer if available
      try {
        const result = this.requestReducer('test-task', { a: 5, b: 3 });
        this.requestManager.completeRequest(requestId, result);
      } catch (error) {
        this.requestManager.failRequest(
          requestId,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    } else {
      // No real worker implementation yet
      this.requestManager.failRequest(
        requestId,
        'Real workers not implemented yet',
      );
    }
  }
}
