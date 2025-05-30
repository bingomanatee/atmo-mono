/**
 * Advanced Worker Management System Types
 */

// ─── Worker Manifest System ────────────────────────────────────────

export interface WorkerActionParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Is parameter required */
  required: boolean;
  /** Parameter description */
  description?: string;
  /** Default value if not required */
  defaultValue?: any;
  /** Validation function */
  validator?: (value: any) => boolean;
}

export interface WorkerActionDefinition {
  /** Action identifier */
  actionId: string;
  /** Action description */
  description: string;
  /** Input parameters */
  parameters: WorkerActionParameter[];
  /** Expected response type */
  responseType: string;
  /** Estimated processing time (ms) */
  estimatedDuration?: number;
  /** Whether action can be retried on failure */
  retryable: boolean;
}

export interface WorkerManifest {
  /** Manifest name/identifier */
  name: string;
  /** Version of the manifest */
  version: string;
  /** Browser worker script path */
  browserWorkerPath: string;
  /** Node.js worker script path */
  nodeWorkerPath: string;
  /** Supported actions */
  actions: WorkerActionDefinition[];
  /** Worker initialization configuration */
  initConfig?: Record<string, any>;
  /** Maximum concurrent tasks per worker */
  maxConcurrentTasks?: number;
  /** Default timeout for tasks (ms) */
  defaultTimeout?: number;
}

export interface IInitWorkerBank {
  /** Unique identifier for this worker group */
  bankId: string;
  /** Worker manifest */
  manifest: WorkerManifest;
  /** Number of workers to create in this bank */
  workerCount: number;
  /** Optional runtime configuration */
  config?: Record<string, any>;
}

// ─── Core Message Types ────────────────────────────────────────────

export interface WorkerMessage {
  /** Unique action identifier */
  actionId: string;
  /** Unique task identifier */
  taskId: string;
  /** Message payload */
  payload: any;
  /** Timestamp when message was created */
  timestamp: number;
  /** Target worker bank (optional, for routing) */
  targetBank?: string;
  /** Target worker ID (optional, for specific worker) */
  targetWorker?: string;
}

export interface WorkerResponse {
  /** Original action ID */
  actionId: string;
  /** Original task ID */
  taskId: string;
  /** Response payload */
  payload: any;
  /** Success status */
  success: boolean;
  /** Error information if failed */
  error?: WorkerError;
  /** Worker ID that processed the message */
  workerId: string;
  /** Bank ID that processed the message */
  bankId: string;
  /** Timestamp when response was created */
  timestamp: number;
  /** Processing duration in milliseconds */
  duration?: number;
}

// ─── Error Protocol ────────────────────────────────────────────────

export interface WorkerError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Error category */
  category: 'validation' | 'processing' | 'timeout' | 'system' | 'network' | 'unknown';
  /** Whether the task can be retried */
  retryable: boolean;
  /** Additional error details */
  details?: Record<string, any>;
  /** Stack trace (if available) */
  stack?: string;
  /** Timestamp when error occurred */
  timestamp: number;
}

export interface WorkerRetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries (ms) */
  baseDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Maximum delay between retries (ms) */
  maxDelay: number;
  /** Which error categories should be retried */
  retryableCategories: WorkerError['category'][];
}

// ─── Activity Tracking Types ───────────────────────────────────────

export interface WorkerActivity {
  /** Worker ID */
  workerId: string;
  /** Bank ID */
  bankId: string;
  /** Total messages sent to this worker */
  messagesSent: number;
  /** Total messages completed by this worker */
  messagesCompleted: number;
  /** Current load (pending messages) */
  currentLoad: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Average response time */
  averageResponseTime: number;
  /** Worker status */
  status: 'idle' | 'busy' | 'error' | 'offline';
}

export interface BankActivity {
  /** Bank ID */
  bankId: string;
  /** Total workers in bank */
  workerCount: number;
  /** Active workers */
  activeWorkers: number;
  /** Total messages sent to bank */
  totalMessages: number;
  /** Total completed messages */
  completedMessages: number;
  /** Current bank load */
  currentLoad: number;
  /** Worker activities */
  workers: Map<string, WorkerActivity>;
}

// ─── Mock Worker Types ─────────────────────────────────────────────

export interface MockWorkerConfig {
  /** Simulated processing delay (ms) */
  processingDelay: number;
  /** Failure rate (0-1) */
  failureRate: number;
  /** Custom response generator */
  responseGenerator?: (message: WorkerMessage) => any;
}

export interface IWorkerLike {
  /** Post message to worker */
  postMessage(message: any): void;
  /** Message handler */
  onmessage: ((event: MessageEvent) => void) | null;
  /** Error handler */
  onerror: ((event: ErrorEvent) => void) | null;
  /** Terminate worker */
  terminate(): void;
}

// ─── Environment Detection Types ───────────────────────────────────

export interface EnvironmentCapabilities {
  /** Browser Web Workers available */
  webWorkers: boolean;
  /** Node.js Worker Threads available */
  nodeWorkers: boolean;
  /** IndexedDB available */
  indexedDB: boolean;
  /** Environment type */
  environment: 'browser' | 'node' | 'unknown';
  /** Hardware concurrency */
  concurrency: number;
}

export interface WorkerDelegate {
  /** Execute task without workers */
  executeTask(message: WorkerMessage): Promise<WorkerResponse>;
  /** Check if delegate can handle task */
  canHandle(actionId: string): boolean;
}

// ─── Event Types ───────────────────────────────────────────────────

export type WorkerEventType = 
  | 'bank-initialized'
  | 'worker-created'
  | 'worker-terminated'
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'task-retried'
  | 'bank-overloaded'
  | 'worker-offline'
  | 'worker-online';

export interface WorkerEvent {
  type: WorkerEventType;
  bankId?: string;
  workerId?: string;
  taskId?: string;
  data?: any;
  timestamp: number;
}
