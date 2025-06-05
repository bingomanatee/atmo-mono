/**
 * Centralized status type constants to avoid magic strings
 */

// Process status types
export const PROCESS_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Task status types
export const TASK_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// Plate status types
export const PLATE_STATUS = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  GENERATING_PLATELETS: 'generating-platelets',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  ERROR: 'error',
  VISUALIZED: 'visualized',
} as const;

// Worker status types
export const WORKER_STATUS = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  BUSY: 'busy',
  ERROR: 'error',
  TERMINATED: 'terminated',
} as const;

// Simulation status types
export const SIMULATION_STATUS = {
  NOT_STARTED: 'not-started',
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// Connection status types
export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
} as const;

// All status types combined with proper namespacing
export const STATUS_TYPES = {
  PROCESS: PROCESS_STATUS,
  TASK: TASK_STATUS,
  PLATE: PLATE_STATUS,
  WORKER: WORKER_STATUS,
  SIMULATION: SIMULATION_STATUS,
  CONNECTION: CONNECTION_STATUS,
} as const;

// Type definitions for each status category
export type ProcessStatus = typeof PROCESS_STATUS[keyof typeof PROCESS_STATUS];
export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];
export type PlateStatus = typeof PLATE_STATUS[keyof typeof PLATE_STATUS];
export type WorkerStatus = typeof WORKER_STATUS[keyof typeof WORKER_STATUS];
export type SimulationStatus = typeof SIMULATION_STATUS[keyof typeof SIMULATION_STATUS];
export type ConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

// Union type for all status types
export type AnyStatus = ProcessStatus | TaskStatus | PlateStatus | WorkerStatus | SimulationStatus | ConnectionStatus;

// Helper functions to check status types
export function isProcessStatus(status: string): status is ProcessStatus {
  return Object.values(PROCESS_STATUS).includes(status as ProcessStatus);
}

export function isTaskStatus(status: string): status is TaskStatus {
  return Object.values(TASK_STATUS).includes(status as TaskStatus);
}

export function isPlateStatus(status: string): status is PlateStatus {
  return Object.values(PLATE_STATUS).includes(status as PlateStatus);
}

export function isWorkerStatus(status: string): status is WorkerStatus {
  return Object.values(WORKER_STATUS).includes(status as WorkerStatus);
}

export function isValidStatus(status: string): status is AnyStatus {
  return isProcessStatus(status) || isTaskStatus(status) || isPlateStatus(status) || 
         isWorkerStatus(status) || Object.values(SIMULATION_STATUS).includes(status as SimulationStatus) ||
         Object.values(CONNECTION_STATUS).includes(status as ConnectionStatus);
}
