/**
 * Responder Interface - Simple abstraction for request processing
 */

import type { TaskManager } from './TaskManager';

export interface TaskIdentifier {
  id: string;
  name: string;
}

export interface TaskResponse {
  task: TaskIdentifier;
  output?: any;
  error?: any;
}

export interface Responder {
  /**
   * Attach to a TaskManager to listen for requests
   */
  attachRequestManager(manager: TaskManager): Promise<void>;

  /**
   * Perform a specific task
   */
  perform(task: TaskIdentifier, payload: any): Promise<TaskResponse>;
}
