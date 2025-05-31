/**
 * Minimal TaskManager for POC
 */

import { v4 as uuid } from 'uuid';
import { Subject, filter, map, take, Observable } from 'rxjs';
import type { Bank, Task, Request, SystemMetrics } from './data-models';

export interface TaskManagerConfig {
  name: string;
}

export const TASK_MANAGER_EVENTS = {
  REQUEST_SUBMITTED: 'request-submitted',
  REQUEST_READY: 'request-ready',
  REQUEST_CLAIMED: 'request-claimed',
  REQUEST_CLAIM_CONFIRMED: 'request-claim-confirmed',
  REQUEST_COMPLETED: 'request-completed',
  REQUEST_FAILED: 'request-failed',
  REQUEST_TIMEOUT: 'request-timeout',
} as const;

export type TaskManagerEventType =
  (typeof TASK_MANAGER_EVENTS)[keyof typeof TASK_MANAGER_EVENTS];

export interface TaskManagerEvent {
  type: TaskManagerEventType;
  requestId: string;
  taskId?: string;
  clientId?: string;
  maxTime?: number;
  responderId?: string; // For claim/confirm events
  payload?: any; // Abstract untyped unit
}

export class TaskManager {
  private name: string;
  private events$ = new Subject<TaskManagerEvent>();
  private taskClaims = new Map<string, string>(); // requestId -> assignedResponderId

  constructor(config: TaskManagerConfig) {
    this.name = config.name;

    // Subscribe to own events to handle claim protocol
    this.setupClaimProtocol();

    console.log(`🔧 TaskManager '${this.name}' initialized`);
  }

  // ─── Request Processing ────────────────────────────────────────────

  submitRequest(
    taskId: string,
    parameters: Record<string, any>,
    options: { clientId: string; priority?: number; maxTime?: number },
  ): Observable<any> {
    const requestId = uuid();
    const maxTime = options.maxTime || 30000;

    // Create result observable before emitting events
    const result$ = this.events$.pipe(
      filter(
        (event) =>
          (event.type === TASK_MANAGER_EVENTS.REQUEST_COMPLETED ||
            event.type === TASK_MANAGER_EVENTS.REQUEST_FAILED ||
            event.type === TASK_MANAGER_EVENTS.REQUEST_TIMEOUT) &&
          event.requestId === requestId,
      ),
      map((event) => {
        if (event.type === TASK_MANAGER_EVENTS.REQUEST_COMPLETED) {
          return event.payload; // Return the actual result
        } else if (event.type === TASK_MANAGER_EVENTS.REQUEST_TIMEOUT) {
          throw new Error('Request timed out');
        } else {
          throw new Error(event.payload?.error || 'Request failed');
        }
      }),
      take(1),
    );

    // Emit request-submitted event
    this.events$.next({
      type: TASK_MANAGER_EVENTS.REQUEST_SUBMITTED,
      requestId,
      taskId,
      clientId: options.clientId,
      maxTime,
      payload: parameters,
    });

    // Emit request-ready event
    setTimeout(() => {
      this.events$.next({
        type: TASK_MANAGER_EVENTS.REQUEST_READY,
        requestId,
        taskId,
        clientId: options.clientId,
        maxTime,
        payload: parameters,
      });
    }, 10);

    return result$;
  }

  // ─── Event-Only State Management ──────────────────────────────────

  completeRequest(requestId: string, result: any): void {
    this.events$.next({
      type: TASK_MANAGER_EVENTS.REQUEST_COMPLETED,
      requestId,
      payload: result,
    });
  }

  failRequest(requestId: string, error: string): void {
    this.events$.next({
      type: TASK_MANAGER_EVENTS.REQUEST_FAILED,
      requestId,
      payload: { error },
    });
  }

  timeoutRequest(requestId: string): void {
    this.events$.next({
      type: TASK_MANAGER_EVENTS.REQUEST_TIMEOUT,
      requestId,
    });
  }

  // ─── Claim Protocol Setup ──────────────────────────────────────────

  private setupClaimProtocol(): void {
    this.events$
      .pipe(
        filter(
          (event) =>
            event.type === TASK_MANAGER_EVENTS.REQUEST_CLAIMED &&
            !!event.responderId,
        ),
      )
      .subscribe((event) => {
        this.handleClaimMessage(event.requestId, event.responderId!);
      });
  }

  private handleClaimMessage(requestId: string, responderId: string): void {
    // Check if task is already claimed
    if (this.taskClaims.has(requestId)) {
      // Silently ignore - task already assigned
      console.log(
        `🤫 TaskManager ignoring late claim from '${responderId}' - request ${requestId} already assigned to '${this.taskClaims.get(requestId)}'`,
      );
      return;
    }

    // First claim wins! Assign immediately
    this.taskClaims.set(requestId, responderId);

    console.log(
      `✅ TaskManager assigned request ${requestId} to '${responderId}' (first claim)`,
    );

    // Emit confirmation immediately
    this.events$.next({
      type: TASK_MANAGER_EVENTS.REQUEST_CLAIM_CONFIRMED,
      requestId,
      responderId,
    });
  }

  // ─── Claim Processing ──────────────────────────────────────────────

  claimRequest(requestId: string, responderId: string): void {
    // Simply emit claim event - self-subscription will handle the logic
    this.events$.next({
      type: TASK_MANAGER_EVENTS.REQUEST_CLAIMED,
      requestId,
      responderId,
    });
  }

  // ─── Authorization Check ───────────────────────────────────────────

  isAuthorizedResponder(requestId: string, responderId: string): boolean {
    return this.taskClaims.get(requestId) === responderId;
  }

  // ─── Public Event Subscription ─────────────────────────────────────

  subscribe(observer: (event: TaskManagerEvent) => void) {
    return this.events$.subscribe(observer);
  }

  pipe(...operators: any[]) {
    return this.events$.pipe(...operators);
  }
}
