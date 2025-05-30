/**
 * Request Management System - Handles the complete lifecycle of worker requests
 */

import { Subject, Observable } from 'rxjs';
import { eventBus, createEvent, EVENT_TYPE } from './EventBus';
import {
  createWorkerMultiverse,
  type WorkerMultiverseResult,
  WORKER_COLLECTIONS,
} from './multiverse/WorkerUniverse';

import type { Multiverse, Universe } from '@wonderlandlabs/multiverse';
import type {
  Bank,
  TaskDefinition,
  BankTaskCapability,
  Request,
  RequestAssignment,
  RequestResult,
  RequestError,
  RequestStatusHistory,
  RequestLifecycle,
  RequestQuery,
  RequestStatus,
  SystemMetrics,
} from './data-models';
import type {
  BankRegisteredEvent,
  RequestSubmittedEvent,
  RequestStatusChangedEvent,
  RequestAssignedEvent,
  RequestCompletedEvent,
  RequestFailedEvent,
} from './EventBus';
import { REQUEST_STATUS, ASSIGNMENT_STATUS } from './data-models';

export interface RequestManagerConfig {
  name: string;
  universeName?: string;
  defaultTimeout: number;
  maxConcurrentPerBank: number;
  testMode?: boolean;
  requestReducer?: (taskId: string, parameters: Record<string, any>) => any;
}

export class RequestManager {
  #config: RequestManagerConfig;
  #multiverse: Multiverse;
  #dataUniverse: Universe;
  public readonly name: string;
  #eventStream = new Subject<any>();

  constructor(config: RequestManagerConfig) {
    this.#config = config;
    this.name = config.name;

    const { multiverse, universe } = createWorkerMultiverse(config);
    this.#multiverse = multiverse;
    this.#dataUniverse = universe;

    console.log(
      `🔧 RequestManager '${this.name}' initialized with universe '${this.#dataUniverse.name}'`,
    );
  }

  #emit(eventType: string, data: any): void {
    this.#eventStream.next({ type: eventType, data, timestamp: Date.now() });
  }

  get events(): Observable<any> {
    return this.#eventStream.asObservable();
  }

  // ─── Collection Shortcuts ──────────────────────────────────────────

  get banksColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.BANKS);
  }

  get tasksColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.TASKS);
  }

  get requestsColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.REQUESTS);
  }

  get assignmentsColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.ASSIGNMENTS);
  }

  get capabilitiesColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.CAPABILITIES);
  }

  get resultsColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.RESULTS);
  }

  get errorsColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.ERRORS);
  }

  get statusHistoryColl() {
    return this.#dataUniverse.get(WORKER_COLLECTIONS.STATUS_HISTORY);
  }

  // ─── ID Generation ─────────────────────────────────────────────────

  #generateRequestId(): string {
    const count = this.requestsColl.size;
    const timestamp = Date.now();
    return `${this.name}-req-${count + 1}-${timestamp}`;
  }

  #generateAssignmentId(requestId: string): string {
    const count = this.assignmentsColl.size;
    return `${this.name}-assign-${requestId}-${count + 1}`;
  }

  #generateResultId(requestId: string): string {
    const timestamp = Date.now();
    return `${this.name}-result-${requestId}-${timestamp}`;
  }

  #generateErrorId(requestId: string): string {
    const timestamp = Date.now();
    return `${this.name}-error-${requestId}-${timestamp}`;
  }

  // ─── Test Mode Processing ──────────────────────────────────────────

  async #processTestRequest(
    requestId: string,
    taskId: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    try {
      // Update status to processing
      await this.updateRequestStatus(
        requestId,
        'processing',
        'Test mode processing',
      );

      // Use request reducer to get test response
      const result = this.#config.requestReducer!(taskId, parameters);

      // Create mock assignment
      const now = new Date().toISOString();
      const assignmentId = this.#generateAssignmentId(requestId);
      const assignment: RequestAssignment = {
        assignmentId,
        requestId,
        bankId: 'test-bank',
        workerId: 'test-worker',
        createdAt: now,
        startedAt: now,
        completedAt: now,
        status: 'completed',
        processingDuration: 100,
      };

      await this.assignments.set(assignmentId, assignment);

      // Create result
      const resultId = this.#generateResultId(requestId);
      const requestResult: RequestResult = {
        resultId,
        requestId,
        assignmentId,
        success: true,
        payload: result,
        metrics: {
          processingTime: 100,
        },
        createdAt: now,
      };

      await this.results.set(resultId, requestResult);

      // Update status to completed
      await this.updateRequestStatus(
        requestId,
        'completed',
        'Test mode completed',
      );

      this.#emit('request-completed', { requestId, result: requestResult });
    } catch (error) {
      await this.#updateRequestStatus(
        requestId,
        'failed',
        `Test mode error: ${error}`,
      );
      this.#emit('request-failed', { requestId, error: String(error) });
    }
  }

  // ─── Bank Management ───────────────────────────────────────────────

  async registerBank(
    bank: Omit<Bank, 'createdAt' | 'updatedAt' | 'metrics'>,
  ): Promise<Bank> {
    const fullBank: Bank = {
      ...bank,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        totalRequestsProcessed: 0,
        averageProcessingTime: 0,
        successRate: 1.0,
        currentLoad: 0,
      },
    };

    await this.banksColl.set(bank.bankId, fullBank);

    // Emit to both EventEmitter and RxJS EventBus
    this.#emit('bank-registered', { bankId: bank.bankId, bank: fullBank });
    eventBus.emit(
      createEvent<BankRegisteredEvent>(
        EVENT_TYPE.BANK_REGISTERED,
        {
          bankId: bank.bankId,
          manifestName: bank.manifestName,
          workerCount: bank.workerCount,
        },
        'RequestManager',
      ),
    );

    return fullBank;
  }

  /**
   * Register a task definition
   */
  async registerTask(
    task: Omit<TaskDefinition, 'createdAt'>,
  ): Promise<TaskDefinition> {
    const fullTask: TaskDefinition = {
      ...task,
      createdAt: new Date().toISOString(),
    };

    await this.tasksColl.set(task.taskId, fullTask);

    this.#emit('task-registered', { taskId: task.taskId, task: fullTask });
    return fullTask;
  }

  /**
   * Register a bank's capability to perform a task
   */
  async registerCapability(
    capability: Omit<
      BankTaskCapability,
      'capabilityId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<BankTaskCapability> {
    const capabilityId = `${capability.bankId}-${capability.taskId}`;
    const fullCapability: BankTaskCapability = {
      ...capability,
      capabilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.capabilities.set(capabilityId, fullCapability);

    this.#emit('capability-registered', {
      capabilityId,
      capability: fullCapability,
    });
    return fullCapability;
  }

  // ─── Request Lifecycle Management ─────────────────────────────────

  /**
   * Submit a new request
   */
  async submitRequest(
    taskId: string,
    parameters: Record<string, any>,
    options: {
      priority?: number;
      clientId: string;
      timeout?: number;
      metadata?: Record<string, any>;
    },
  ): Promise<string> {
    const requestId = this.#generateRequestId();
    const now = new Date().toISOString();

    // Validate task exists
    const task = await this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }

    // Create request
    const request: Request = {
      requestId,
      taskId,
      parameters,
      status: 'pending',
      priority: options.priority || 5,
      clientId: options.clientId,
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata,
    };

    await this.requests.set(requestId, request);
    this.#addStatusHistory({
      requestId,
      fromStatus: 'pending',
      toStatus: 'pending',
      reason: 'Request submitted',
      changedBy: 'system',
    });

    this.#emit('request-submitted', { requestId, request });

    // Handle test mode
    if (this.#config.testMode && this.#config.requestReducer) {
      await this.#processTestRequest(requestId, taskId, parameters);
    } else {
      // Try to assign immediately
      await this.tryAssignRequest(requestId);
    }

    return requestId;
  }

  /**
   * Try to assign a request to an available bank
   */
  private async tryAssignRequest(requestId: string): Promise<boolean> {
    const request = await this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    // Select best bank (includes finding capable banks)
    const bestBank = this.selectBestBank(request);
    if (!bestBank) {
      await this.updateRequestStatus(
        requestId,
        'failed',
        'No capable banks available or all banks busy',
      );
      return false;
    }

    // Create assignment
    const assignmentId = `assign-${requestId}-${Date.now()}`;
    const now = new Date();
    const capability = await this.capabilities.get(
      `${bestBank.bankId}-${request.taskId}`,
    );
    if (!capability) return false;

    const assignment: RequestAssignment = {
      assignmentId,
      requestId,
      bankId: bestBank.bankId,
      createdAt: now.toISOString(),
      assignedAt: now.toISOString(),
      status: 'assigned',
      estimatedCompletionAt: new Date(
        now.getTime() + capability.averageProcessingTime,
      ).toISOString(),
    };

    await this.assignments.set(assignmentId, assignment);
    await this.updateRequestStatus(
      requestId,
      'assigned',
      `Assigned to bank ${bestBank.bankId}`,
    );

    // Update bank load
    bestBank.metrics.currentLoad++;
    capability.currentLoad++;

    this.#emit('request-assigned', {
      requestId,
      assignmentId,
      bankId: bestBank.bankId,
    });

    return true;
  }

  /**
   * Mark request as processing
   */
  async startProcessing(requestId: string, workerId?: string): Promise<void> {
    const request = await this.requests.get(requestId);
    const assignments = await this.assignments.getAll();
    const assignment = assignments.find(
      (a) => a.requestId === requestId && a.status === 'assigned',
    );

    if (!request || !assignment) {
      throw new Error(`Request ${requestId} not found or not assigned`);
    }

    assignment.status = 'processing';
    assignment.startedAt = new Date();
    if (workerId) {
      assignment.workerId = workerId;
    }

    await this.updateRequestStatus(
      requestId,
      'processing',
      `Processing started by ${workerId || 'worker'}`,
    );

    this.#emit('request-processing', {
      requestId,
      assignmentId: assignment.assignmentId,
      workerId,
    });
  }

  /**
   * Complete a request with results
   */
  async completeRequest(
    requestId: string,
    payload: any,
    metrics: { processingTime: number; memoryUsed?: number; cpuTime?: number },
  ): Promise<void> {
    const request = await this.requests.get(requestId);
    const assignments = await this.assignments.getAll();
    const assignment = assignments.find((a) => a.requestId === requestId);

    if (!request || !assignment) {
      throw new Error(`Request ${requestId} not found`);
    }

    const now = new Date();
    const resultId = `result-${requestId}-${now.getTime()}`;

    // Create result
    const result: RequestResult = {
      resultId,
      requestId,
      assignmentId: assignment.assignmentId,
      success: true,
      payload,
      metrics,
      createdAt: now,
    };

    await this.results.set(resultId, result);

    // Update assignment
    assignment.status = 'completed';
    assignment.completedAt = now.toISOString();
    assignment.processingDuration = metrics.processingTime;

    // Update request
    await this.updateRequestStatus(
      requestId,
      'completed',
      'Request completed successfully',
    );

    // Update bank metrics
    const bank = await this.banks.get(assignment.bankId);
    const capability = await this.capabilities.get(
      `${assignment.bankId}-${request.taskId}`,
    );

    if (bank && capability) {
      bank.metrics.currentLoad = Math.max(0, bank.metrics.currentLoad - 1);
      bank.metrics.totalRequestsProcessed++;

      // Update average processing time (exponential moving average)
      const alpha = 0.1;
      bank.metrics.averageProcessingTime =
        (1 - alpha) * bank.metrics.averageProcessingTime +
        alpha * metrics.processingTime;

      capability.currentLoad = Math.max(0, capability.currentLoad - 1);
      capability.averageProcessingTime =
        (1 - alpha) * capability.averageProcessingTime +
        alpha * metrics.processingTime;
    }

    this.#emit('request-completed', { requestId, result });
  }

  /**
   * Fail a request with error information
   */
  async failRequest(
    requestId: string,
    error: Omit<RequestError, 'errorId' | 'requestId' | 'occurredAt'>,
  ): Promise<void> {
    const request = this.requests.get(requestId);
    const assignment = Array.from(this.assignments.values()).find(
      (a) => a.requestId === requestId,
    );

    if (!request || !assignment) {
      throw new Error(`Request ${requestId} not found`);
    }

    const now = new Date();
    const errorId = `error-${requestId}-${now.getTime()}`;

    // Create error record
    const fullError: RequestError = {
      ...error,
      errorId,
      requestId,
      assignmentId: assignment.assignmentId,
      occurredAt: now,
    };

    this.errors.set(errorId, fullError);

    // Update assignment
    assignment.status = 'failed';
    assignment.completedAt = now;

    // Mark request as failed
    await this.updateRequestStatus(
      requestId,
      'failed',
      `Request failed: ${error.message}`,
    );

    // Update bank metrics
    const bank = this.banks.get(assignment.bankId);
    const capability = this.capabilities.get(
      `${assignment.bankId}-${request.taskId}`,
    );
    if (bank) {
      bank.metrics.currentLoad = Math.max(0, bank.metrics.currentLoad - 1);
      bank.metrics.totalRequestsProcessed++;
      // Update success rate
      const alpha = 0.1;
      bank.metrics.successRate = (1 - alpha) * bank.metrics.successRate;
    }
    if (capability) {
      capability.currentLoad = Math.max(0, capability.currentLoad - 1);
      capability.successRate = (1 - alpha) * capability.successRate;
    }

    this.emit('request-failed', { requestId, error: fullError });
  }

  // ─── Query and Retrieval Methods ──────────────────────────────────

  /**
   * Get complete request lifecycle information
   */
  getRequestLifecycle(requestId: string): RequestLifecycle | null {
    const request = this.requests.get(requestId);
    if (!request) return null;

    const assignment = Array.from(this.assignments.values()).find(
      (a) => a.requestId === requestId,
    );
    const result = Array.from(this.results.values()).find(
      (r) => r.requestId === requestId,
    );
    const errors = Array.from(this.errors.values()).filter(
      (e) => e.requestId === requestId,
    );
    const history = this.statusHistory.get(requestId) || [];
    const task = this.tasks.get(request.taskId)!;
    const bank = assignment ? this.banks.get(assignment.bankId) : undefined;
    const capability = assignment
      ? this.capabilities.get(`${assignment.bankId}-${request.taskId}`)
      : undefined;

    return {
      request,
      assignment,
      result,
      errors,
      statusHistory: history,
      task,
      bank,
      capability,
    };
  }

  /**
   * Query requests with filters
   */
  queryRequests(query: RequestQuery): Request[] {
    let results = Array.from(this.requests.values());

    // Apply filters
    if (query.status) {
      const statuses = Array.isArray(query.status)
        ? query.status
        : [query.status];
      results = results.filter((r) => statuses.includes(r.status));
    }

    if (query.taskId) {
      const taskIds = Array.isArray(query.taskId)
        ? query.taskId
        : [query.taskId];
      results = results.filter((r) => taskIds.includes(r.taskId));
    }

    if (query.clientId) {
      const clientIds = Array.isArray(query.clientId)
        ? query.clientId
        : [query.clientId];
      results = results.filter((r) => clientIds.includes(r.clientId));
    }

    if (query.priorityRange) {
      results = results.filter(
        (r) =>
          r.priority >= query.priorityRange!.min &&
          r.priority <= query.priorityRange!.max,
      );
    }

    if (query.dateRange) {
      results = results.filter(
        (r) =>
          r.createdAt >= query.dateRange!.from &&
          r.createdAt <= query.dateRange!.to,
      );
    }

    // Apply sorting and pagination
    if (query.pagination) {
      const {
        sortBy = 'createdAt',
        sortOrder = 'desc',
        offset = 0,
        limit = 100,
      } = query.pagination;

      results.sort((a, b) => {
        const aVal = (a as any)[sortBy];
        const bVal = (b as any)[sortBy];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      results = results.slice(offset, offset + limit);
    }

    return results;
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const requests = Array.from(this.requests.values());
    const banks = Array.from(this.banks.values());
    const errors = Array.from(this.errors.values());

    const requestsByStatus = requests.reduce(
      (acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1;
        return acc;
      },
      {} as Record<RequestStatus, number>,
    );

    const completedRequests = requests.filter((r) => r.status === 'completed');
    const avgProcessingTime =
      completedRequests.length > 0
        ? completedRequests.reduce((sum, req) => {
            const assignment = Array.from(this.assignments.values()).find(
              (a) => a.requestId === req.requestId,
            );
            return sum + (assignment?.processingDuration || 0);
          }, 0) / completedRequests.length
        : 0;

    const successRate =
      requests.length > 0
        ? completedRequests.length /
          requests.filter((r) => ['completed', 'failed'].includes(r.status))
            .length
        : 1;

    return {
      totalRequests: requests.length,
      requestsByStatus,
      averageProcessingTime: avgProcessingTime,
      successRate,
      activeBanks: banks.filter((b) => b.status === 'active').length,
      totalWorkerCapacity: banks.reduce((sum, b) => sum + b.workerCount, 0),
      currentLoad: banks.reduce((sum, b) => sum + b.metrics.currentLoad, 0),
      requestsPerMinute: 0, // Would need time-based calculation
      errorRate: errors.length / Math.max(requests.length, 1),
      topErrors: [], // Would need aggregation
      bankPerformance: banks.map((b) => ({
        bankId: b.bankId,
        requestsProcessed: b.metrics.totalRequestsProcessed,
        averageTime: b.metrics.averageProcessingTime,
        successRate: b.metrics.successRate,
      })),
    };
  }

  // ─── Private Helper Methods ───────────────────────────────────────

  private findCapableBanks(taskId: string): Bank[] {
    const capableBankIds = Array.from(this.capabilities.values())
      .filter((cap) => cap.taskId === taskId)
      .map((cap) => cap.bankId);

    return capableBankIds
      .map((bankId) => this.banks.get(bankId))
      .filter(
        (bank): bank is Bank => bank !== undefined && bank.status === 'active',
      );
  }

  private selectBestBank(request: Request): Bank | null {
    // Find capable banks first
    const capableBankIds = Array.from(this.capabilities.values())
      .filter((cap) => cap.taskId === request.taskId)
      .map((cap) => cap.bankId);

    const capableBanks = capableBankIds
      .map((bankId) => this.banks.get(bankId))
      .filter(
        (bank): bank is Bank => bank !== undefined && bank.status === 'active',
      );

    if (capableBanks.length === 0) return null;

    // Score banks based on load, proficiency, and success rate
    const scoredBanks = capableBanks
      .map((bank) => {
        const capability = this.capabilities.get(
          `${bank.bankId}-${request.taskId}`,
        )!;

        // Check if bank can take more work
        if (capability.currentLoad >= capability.maxConcurrent) {
          return null;
        }

        const loadScore = 1 - capability.currentLoad / capability.maxConcurrent;
        const proficiencyScore = capability.proficiency;
        const successScore = capability.successRate;

        const totalScore =
          loadScore * 0.4 + proficiencyScore * 0.3 + successScore * 0.3;

        return { bank, score: totalScore };
      })
      .filter((item): item is { bank: Bank; score: number } => item !== null);

    if (scoredBanks.length === 0) return null;

    // Return bank with highest score
    scoredBanks.sort((a, b) => b.score - a.score);
    return scoredBanks[0].bank;
  }

  private async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    reason: string,
  ): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) return;

    const oldStatus = request.status;
    request.status = status;
    request.updatedAt = new Date();

    this.#addStatusHistory({
      requestId,
      fromStatus: oldStatus,
      toStatus: status,
      reason,
      changedBy: 'system',
    });

    this.emit('request-status-changed', {
      requestId,
      fromStatus: oldStatus,
      toStatus: status,
      reason,
    });
  }

  #addStatusHistory(params: {
    requestId: string;
    fromStatus: RequestStatus;
    toStatus: RequestStatus;
    reason: string;
    changedBy: string;
  }): void {
    const { requestId, fromStatus, toStatus, reason, changedBy } = params;
    const historyId = `hist-${requestId}-${Date.now()}`;
    const entry: RequestStatusHistory = {
      historyId,
      requestId,
      fromStatus,
      toStatus,
      reason,
      changedAt: new Date().toISOString(),
      changedBy,
    };

    const history = this.statusHistory.get(requestId) || [];
    history.push(entry);
    this.statusHistory.set(requestId, history);
  }
}
