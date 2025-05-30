/**
 * Central Event Bus for Worker Management System
 */

import { Subject, Observable, filter, map } from 'rxjs';
import type { RequestStatus, AssignmentStatus } from './data-models';

// Event Type Constants
export const EVENT_TYPE = {
  // Bank Events
  BANK_REGISTERED: 'bank-registered',
  BANK_STATUS_CHANGED: 'bank-status-changed',
  BANK_WORKER_ADDED: 'bank-worker-added',
  BANK_WORKER_REMOVED: 'bank-worker-removed',
  
  // Task Events
  TASK_REGISTERED: 'task-registered',
  CAPABILITY_REGISTERED: 'capability-registered',
  
  // Request Lifecycle Events
  REQUEST_SUBMITTED: 'request-submitted',
  REQUEST_STATUS_CHANGED: 'request-status-changed',
  REQUEST_ASSIGNED: 'request-assigned',
  REQUEST_QUEUED: 'request-queued',
  REQUEST_PROCESSING: 'request-processing',
  REQUEST_COMPLETED: 'request-completed',
  REQUEST_FAILED: 'request-failed',
  REQUEST_CANCELLED: 'request-cancelled',
  REQUEST_TIMEOUT: 'request-timeout',
  
  // Assignment Events
  ASSIGNMENT_CREATED: 'assignment-created',
  ASSIGNMENT_STATUS_CHANGED: 'assignment-status-changed',
  
  // Worker Events
  WORKER_CREATED: 'worker-created',
  WORKER_TERMINATED: 'worker-terminated',
  WORKER_ERROR: 'worker-error',
  WORKER_IDLE: 'worker-idle',
  WORKER_BUSY: 'worker-busy',
  
  // System Events
  SYSTEM_OVERLOAD: 'system-overload',
  SYSTEM_RECOVERED: 'system-recovered',
  METRICS_UPDATED: 'metrics-updated',
} as const;

export type EventType = typeof EVENT_TYPE[keyof typeof EVENT_TYPE];

// Base Event Interface
export interface BaseEvent {
  type: EventType;
  timestamp: number;
  source: string;
}

// Specific Event Interfaces
export interface BankRegisteredEvent extends BaseEvent {
  type: typeof EVENT_TYPE.BANK_REGISTERED;
  data: {
    bankId: string;
    manifestName: string;
    workerCount: number;
  };
}

export interface RequestSubmittedEvent extends BaseEvent {
  type: typeof EVENT_TYPE.REQUEST_SUBMITTED;
  data: {
    requestId: string;
    taskId: string;
    clientId: string;
    priority: number;
  };
}

export interface RequestStatusChangedEvent extends BaseEvent {
  type: typeof EVENT_TYPE.REQUEST_STATUS_CHANGED;
  data: {
    requestId: string;
    fromStatus: RequestStatus;
    toStatus: RequestStatus;
    reason: string;
  };
}

export interface RequestAssignedEvent extends BaseEvent {
  type: typeof EVENT_TYPE.REQUEST_ASSIGNED;
  data: {
    requestId: string;
    assignmentId: string;
    bankId: string;
    workerId?: string;
    queuePosition?: number;
  };
}

export interface RequestCompletedEvent extends BaseEvent {
  type: typeof EVENT_TYPE.REQUEST_COMPLETED;
  data: {
    requestId: string;
    assignmentId: string;
    processingTime: number;
    success: boolean;
  };
}

export interface RequestFailedEvent extends BaseEvent {
  type: typeof EVENT_TYPE.REQUEST_FAILED;
  data: {
    requestId: string;
    assignmentId: string;
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
  };
}

export interface WorkerCreatedEvent extends BaseEvent {
  type: typeof EVENT_TYPE.WORKER_CREATED;
  data: {
    workerId: string;
    bankId: string;
    workerType: 'real' | 'mock';
  };
}

export interface WorkerErrorEvent extends BaseEvent {
  type: typeof EVENT_TYPE.WORKER_ERROR;
  data: {
    workerId: string;
    bankId: string;
    error: string;
    taskId?: string;
  };
}

export interface SystemOverloadEvent extends BaseEvent {
  type: typeof EVENT_TYPE.SYSTEM_OVERLOAD;
  data: {
    totalLoad: number;
    capacity: number;
    overloadPercentage: number;
    affectedBanks: string[];
  };
}

export interface MetricsUpdatedEvent extends BaseEvent {
  type: typeof EVENT_TYPE.METRICS_UPDATED;
  data: {
    totalRequests: number;
    activeRequests: number;
    completedRequests: number;
    failedRequests: number;
    averageProcessingTime: number;
    systemLoad: number;
  };
}

// Union type of all events
export type SystemEvent = 
  | BankRegisteredEvent
  | RequestSubmittedEvent
  | RequestStatusChangedEvent
  | RequestAssignedEvent
  | RequestCompletedEvent
  | RequestFailedEvent
  | WorkerCreatedEvent
  | WorkerErrorEvent
  | SystemOverloadEvent
  | MetricsUpdatedEvent;

/**
 * Central Event Bus for the Worker Management System
 */
export class EventBus {
  private static instance: EventBus;
  private eventSubject = new Subject<SystemEvent>();
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /**
   * Emit an event to all subscribers
   */
  emit(event: SystemEvent): void {
    this.eventSubject.next(event);
  }
  
  /**
   * Subscribe to all events
   */
  events$(): Observable<SystemEvent> {
    return this.eventSubject.asObservable();
  }
  
  /**
   * Subscribe to specific event types
   */
  eventsOfType<T extends SystemEvent>(eventType: T['type']): Observable<T> {
    return this.eventSubject.pipe(
      filter(event => event.type === eventType),
      map(event => event as T)
    );
  }
  
  /**
   * Subscribe to events from a specific source
   */
  eventsFromSource(source: string): Observable<SystemEvent> {
    return this.eventSubject.pipe(
      filter(event => event.source === source)
    );
  }
  
  /**
   * Subscribe to request events for a specific request
   */
  requestEvents(requestId: string): Observable<SystemEvent> {
    return this.eventSubject.pipe(
      filter(event => 
        'data' in event && 
        typeof event.data === 'object' && 
        event.data !== null &&
        'requestId' in event.data && 
        event.data.requestId === requestId
      )
    );
  }
  
  /**
   * Subscribe to bank events for a specific bank
   */
  bankEvents(bankId: string): Observable<SystemEvent> {
    return this.eventSubject.pipe(
      filter(event => 
        'data' in event && 
        typeof event.data === 'object' && 
        event.data !== null &&
        'bankId' in event.data && 
        event.data.bankId === bankId
      )
    );
  }
  
  /**
   * Get event statistics
   */
  getEventStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
  } {
    // This would need to be implemented with a buffer/cache
    // For now, return empty stats
    return {
      totalEvents: 0,
      eventsByType: {},
    };
  }
  
  /**
   * Clear all subscriptions (useful for testing)
   */
  reset(): void {
    this.eventSubject.complete();
    this.eventSubject = new Subject<SystemEvent>();
  }
}

/**
 * Global event bus instance
 */
export const eventBus = EventBus.getInstance();

/**
 * Helper function to create events with common fields
 */
export function createEvent<T extends SystemEvent>(
  type: T['type'],
  data: T['data'],
  source: string = 'system'
): T {
  return {
    type,
    data,
    timestamp: Date.now(),
    source,
  } as T;
}
