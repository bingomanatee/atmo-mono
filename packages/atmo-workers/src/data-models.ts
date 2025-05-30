/**
 * Data Models for Worker Bank Request Management System
 */

export interface Bank {
  bankId: string;
  name: string;
  description: string;
  manifestName: string;
  workerCount: number;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  config: Record<string, any>;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  metrics: {
    totalRequestsProcessed: number;
    averageProcessingTime: number;
    successRate: number;
    currentLoad: number;
  };
}

export interface TaskDefinition {
  taskId: string;
  actionId: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
  parametersSchema: Record<string, any>;
  createdAt: string; // ISO string
}

export interface BankTaskCapability {
  capabilityId: string;
  bankId: string;
  taskId: string;
  proficiency: number;
  averageProcessingTime: number;
  successRate: number;
  currentLoad: number;
  maxConcurrent: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Request Status Constants
export const REQUEST_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
} as const;

export type RequestStatus =
  (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export interface Request {
  requestId: string;
  taskId: string;
  parameters: Record<string, any>;
  status: RequestStatus;
  priority: number;
  clientId: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  metadata?: Record<string, any>;
}

// Assignment Status Constants
export const ASSIGNMENT_STATUS = {
  CREATED: 'created',
  QUEUED: 'queued',
  ASSIGNED: 'assigned',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type AssignmentStatus =
  (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];

export interface RequestAssignment {
  assignmentId: string;
  requestId: string;
  bankId: string;
  workerId?: string;
  createdAt: string; // ISO string
  queuedAt?: string; // ISO string
  assignedAt?: string; // ISO string
  startedAt?: string; // ISO string
  completedAt?: string; // ISO string
  status: AssignmentStatus;
  estimatedCompletionAt?: string; // ISO string
  processingDuration?: number;
  queuePosition?: number;
}

export interface RequestResult {
  resultId: string;
  requestId: string;
  assignmentId: string;
  success: boolean;
  payload?: any;
  error?: RequestError;
  metrics: {
    processingTime: number;
    memoryUsed?: number;
    cpuTime?: number;
    networkTime?: number;
  };
  createdAt: string; // ISO string
}

// Error Category Constants
export const ERROR_CATEGORY = {
  VALIDATION: 'validation',
  PROCESSING: 'processing',
  TIMEOUT: 'timeout',
  SYSTEM: 'system',
  NETWORK: 'network',
  RESOURCE: 'resource',
  UNKNOWN: 'unknown',
} as const;

export type ErrorCategory =
  (typeof ERROR_CATEGORY)[keyof typeof ERROR_CATEGORY];

// Error Severity Constants
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type ErrorSeverity =
  (typeof ERROR_SEVERITY)[keyof typeof ERROR_SEVERITY];

export interface RequestError {
  errorId: string;
  requestId: string;
  assignmentId?: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  details: Record<string, any>;
  stackTrace?: string;
  occurredAt: string; // ISO string
}

export interface RequestStatusHistory {
  historyId: string;
  requestId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  reason: string;
  context?: Record<string, any>;
  changedAt: string; // ISO string
  changedBy: string;
}

export interface RequestLifecycle {
  request: Request;
  assignment?: RequestAssignment;
  result?: RequestResult;
  errors: RequestError[];
  statusHistory: RequestStatusHistory[];
  task: TaskDefinition;
  bank?: Bank;
  capability?: BankTaskCapability;
}

export interface RequestSummary {
  requestId: string;
  taskName: string;
  status: RequestStatus;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  assignedBank?: string;
  processingTime?: number;
  errorCount: number;
}

// ─── Query and Filter Types ────────────────────────────────────────

export interface RequestQuery {
  /** Filter by status */
  status?: RequestStatus | RequestStatus[];
  /** Filter by task ID */
  taskId?: string | string[];
  /** Filter by bank ID */
  bankId?: string | string[];
  /** Filter by client ID */
  clientId?: string | string[];
  /** Filter by priority range */
  priorityRange?: { min: number; max: number };
  /** Filter by date range */
  dateRange?: { from: Date; to: Date };
  /** Filter by tags */
  tags?: string[];
  /** Text search in parameters */
  searchText?: string;
  /** Pagination */
  pagination?: {
    offset: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

export interface BankQuery {
  /** Filter by status */
  status?: Bank['status'] | Bank['status'][];
  /** Filter by manifest name */
  manifestName?: string | string[];
  /** Filter by capability (task ID) */
  canPerformTask?: string;
  /** Filter by load range */
  loadRange?: { min: number; max: number };
  /** Filter by success rate range */
  successRateRange?: { min: number; max: number };
}

// ─── Analytics and Reporting Types ─────────────────────────────────

export interface SystemMetrics {
  /** Total requests in system */
  totalRequests: number;
  /** Requests by status */
  requestsByStatus: Record<RequestStatus, number>;
  /** Average processing time */
  averageProcessingTime: number;
  /** Overall success rate */
  successRate: number;
  /** Active banks */
  activeBanks: number;
  /** Total worker capacity */
  totalWorkerCapacity: number;
  /** Current system load */
  currentLoad: number;
  /** Requests per minute */
  requestsPerMinute: number;
  /** Error rate */
  errorRate: number;
  /** Most common errors */
  topErrors: Array<{ code: string; count: number }>;
  /** Bank performance */
  bankPerformance: Array<{
    bankId: string;
    requestsProcessed: number;
    averageTime: number;
    successRate: number;
  }>;
}

export interface RequestAnalytics {
  /** Request volume over time */
  volumeOverTime: Array<{ timestamp: Date; count: number }>;
  /** Processing time distribution */
  processingTimeDistribution: Array<{ range: string; count: number }>;
  /** Error distribution */
  errorDistribution: Array<{ category: string; count: number }>;
  /** Task popularity */
  taskPopularity: Array<{ taskId: string; count: number }>;
  /** Peak usage hours */
  peakHours: Array<{ hour: number; averageLoad: number }>;
}
