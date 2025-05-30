/**
 * Atmo Workers - Advanced Worker Management System
 *
 * A comprehensive worker management system with manifest-driven configuration,
 * request lifecycle tracking, load balancing, and intelligent task delegation.
 */

// ─── Core Classes ──────────────────────────────────────────────────
export { WorkerManager } from './WorkerManager';
export { RequestManager } from './RequestManager';
export { ActivityTracer } from './ActivityTracer';
export { EnvironmentSniffer } from './EnvironmentSniffer';
export { WorkerMessageClass } from './WorkerMessageClass';
export { MockWorker, MockWorkerFactory } from './MockWorker';

// ─── Multiverse System ─────────────────────────────────────────────
export {
  createWorkerMultiverse,
  type WorkerMultiverseResult,
  WORKER_COLLECTIONS,
} from './multiverse/WorkerUniverse';

// ─── Event System ──────────────────────────────────────────────────
export { eventBus, EventBus, createEvent, EVENT_TYPE } from './EventBus';
export type * from './EventBus';

// ─── Types and Interfaces ──────────────────────────────────────────
export type * from './types';
export type * from './data-models';

// ─── Manifests ─────────────────────────────────────────────────────
export * from './manifests';

// ─── Utilities ─────────────────────────────────────────────────────

/**
 * Create a basic worker manager with common configuration
 */
export function createWorkerManager(config?: {
  name?: string;
  universeName?: string;
  defaultTimeout?: number;
  maxConcurrentPerBank?: number;
  testMode?: boolean;
  requestReducer?: (taskId: string, parameters: Record<string, any>) => any;
}) {
  return new RequestManager({
    name: config?.name || 'default-manager',
    universeName: config?.universeName,
    defaultTimeout: config?.defaultTimeout || 30000,
    maxConcurrentPerBank: config?.maxConcurrentPerBank || 10,
    testMode: config?.testMode,
    requestReducer: config?.requestReducer,
  });
}

/**
 * Get environment capabilities
 */
export function getEnvironmentCapabilities() {
  return EnvironmentSniffer.getCapabilities();
}

/**
 * Check if workers are available in current environment
 */
export function hasWorkerSupport() {
  return EnvironmentSniffer.hasAnyWorkers();
}

/**
 * Get recommended worker count for current environment
 */
export function getRecommendedWorkerCount() {
  return EnvironmentSniffer.getRecommendedWorkerCount();
}

// ─── Version ───────────────────────────────────────────────────────
export const VERSION = '1.0.0';

// ─── Default Exports ───────────────────────────────────────────────
export default {
  WorkerManager,
  RequestManager,
  ActivityTracer,
  EnvironmentSniffer,
  WorkerMessageClass,
  MockWorker,
  MockWorkerFactory,
  createWorkerManager,
  getEnvironmentCapabilities,
  hasWorkerSupport,
  getRecommendedWorkerCount,
  VERSION,
};
