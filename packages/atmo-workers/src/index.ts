/**
 * Atmo Workers - Minimal POC Worker Management System
 */

// ─── Imports for Internal Use ──────────────────────────────────────
import { TaskManager } from './TaskManager';
import { WorkerResponder } from './WorkerResponder';
import { BrowserWorker } from './BrowserWorker';

// ─── Core Classes ──────────────────────────────────────────────────
export { TaskManager, TASK_MANAGER_EVENTS } from './TaskManager';
export { WorkerResponder } from './WorkerResponder';
export { MockResponder } from './MockResponder';
export { BrowserWorker } from './BrowserWorker';

// ─── Interfaces ────────────────────────────────────────────────────
export type { Responder, TaskIdentifier, TaskResponse } from './Responder';
export type { WorkerManifest } from './BrowserWorker';

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

/**
 * Create a browser worker manager with web workers for client-side multiprocessing
 */
export function createBrowserWorkerManager(config: {
  name?: string;
  window: Window;
  workerManifests: Array<{
    name: string;
    scriptUrl: string;
    tasks: string[];
  }>;
  maxConcurrentTasks?: number;
  workerTimeout?: number;
}) {
  const taskManager = new TaskManager({
    name: config.name || 'browser-manager',
  });

  const browserWorker = new BrowserWorker({
    name: `${config.name || 'browser'}-worker`,
    window: config.window,
    taskManager,
    workerManifests: config.workerManifests,
    maxConcurrentTasks: config.maxConcurrentTasks,
    workerTimeout: config.workerTimeout,
  });

  // Auto-attach the browser worker
  browserWorker.attachRequestManager(taskManager);

  return { taskManager, browserWorker };
}
