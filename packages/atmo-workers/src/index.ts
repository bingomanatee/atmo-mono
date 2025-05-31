/**
 * Atmo Workers - Minimal POC Worker Management System
 */

// ─── Imports for Internal Use ──────────────────────────────────────
import { TaskManager } from './TaskManager';
import { WorkerResponder } from './WorkerResponder';

// ─── Core Classes ──────────────────────────────────────────────────
export { TaskManager, TASK_MANAGER_EVENTS } from './TaskManager';
export { WorkerResponder } from './WorkerResponder';
export { MockResponder } from './MockResponder';

// ─── Interfaces ────────────────────────────────────────────────────
export type { Responder, TaskIdentifier, TaskResponse } from './Responder';

// ─── Types and Data Models ─────────────────────────────────────────
export type * from './data-models';

// ─── Utilities ─────────────────────────────────────────────────────

/**
 * Create a worker responder with minimal configuration for POC
 */
export function createWorkerManager(config?: {
  name?: string;
  testMode?: boolean;
  requestReducer?: (taskId: string, parameters: Record<string, any>) => any;
}) {
  const taskManager = new TaskManager({
    name: config?.name || 'poc-manager',
  });
  const workerResponder = new WorkerResponder({
    name: `${config?.name || 'poc'}-responder`,
    testMode: config?.testMode,
    requestReducer: config?.requestReducer,
  });

  // Auto-attach the responder
  workerResponder.attachRequestManager(taskManager);

  return { taskManager, workerResponder };
}
