/**
 * Centralized message type constants to avoid magic strings
 */

// Process lifecycle messages
export const PROCESS_MESSAGES = {
  STARTED: 'process-started',
  COMPLETED: 'process-completed',
  FAILED: 'process-failed',
  PROGRESS: 'process-progress',
} as const;

// Task lifecycle messages
export const TASK_MESSAGES = {
  QUEUED: 'task-queued',
  STARTED: 'task-started',
  COMPLETED: 'task-completed',
  FAILED: 'task-failed',
} as const;

// Platelet generation messages
export const PLATELET_MESSAGES = {
  GENERATED: 'platelet-generated',
  GENERATION_COMPLETE: 'platelet-generation-complete',
} as const;

// Plate lifecycle messages
export const PLATE_MESSAGES = {
  PROGRESS: 'plate-progress',
  COMPLETE: 'plate-complete',
  SIMULATION_SETUP: 'plate-simulation-setup',
} as const;

// Worker status messages
export const WORKER_MESSAGES = {
  READY: 'worker-ready',
  ERROR: 'worker-error',
  STATUS_CHANGE: 'worker-status-change',
} as const;

// Visualization messages
export const VISUALIZATION_MESSAGES = {
  UPDATE: 'visualization-update',
  COMPLETE: 'visualization-complete',
} as const;

// Performance and monitoring messages
export const MONITORING_MESSAGES = {
  PERFORMANCE_METRIC: 'performance-metric',
  PROGRESS_UPDATE: 'progress-update',
  DATABASE_OPERATION: 'database-operation',
} as const;

// Edge detection messages
export const EDGE_DETECTION_MESSAGES = {
  COMPLETE: 'edge-detection-complete',
  PROGRESS: 'edge-detection-progress',
} as const;

// Simulation messages
export const SIMULATION_MESSAGES = {
  STARTED: 'simulation-started',
  COMPLETE: 'simulation-complete',
} as const;

// All message types combined with proper namespacing
export const MESSAGE_TYPES = {
  PROCESS: PROCESS_MESSAGES,
  TASK: TASK_MESSAGES,
  PLATELET: PLATELET_MESSAGES,
  PLATE: PLATE_MESSAGES,
  WORKER: WORKER_MESSAGES,
  VISUALIZATION: VISUALIZATION_MESSAGES,
  MONITORING: MONITORING_MESSAGES,
  EDGE_DETECTION: EDGE_DETECTION_MESSAGES,
  SIMULATION: SIMULATION_MESSAGES,
} as const;

// Type for all valid message types
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

// Helper function to check if a string is a valid message type
export function isValidMessageType(type: string): type is MessageType {
  return Object.values(MESSAGE_TYPES).includes(type as MessageType);
}
