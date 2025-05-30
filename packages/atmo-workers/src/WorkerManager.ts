/**
 * Enhanced Worker Manager with Manifest Support
 */

import { EventEmitter } from 'events';
import { EnvironmentSniffer } from './EnvironmentSniffer';
import { ActivityTracer } from './ActivityTracer';
import { WorkerMessageClass } from './WorkerMessageClass';
import { MockWorker } from './MockWorker';
import { RequestManager, type RequestManagerConfig } from './RequestManager';
import type {
  IInitWorkerBank,
  WorkerManifest,
  WorkerMessage,
  WorkerResponse,
  WorkerError,
  WorkerRetryPolicy,
  IWorkerLike,
  EnvironmentCapabilities,
  WorkerEvent,
} from './types';
import type { Bank, TaskDefinition, BankTaskCapability } from './data-models';

interface WorkerBank {
  bankId: string;
  manifest: WorkerManifest;
  workers: Map<string, IWorkerLike>;
  messageClass: WorkerMessageClass;
  config: Record<string, any>;
}

interface PendingTask {
  message: WorkerMessage;
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  retryCount: number;
  timeout?: NodeJS.Timeout;
}

export class WorkerManager extends EventEmitter {
  private banks: Map<string, WorkerBank> = new Map();
  private activityTracer: ActivityTracer = new ActivityTracer();
  private pendingTasks: Map<string, PendingTask> = new Map();
  private capabilities: EnvironmentCapabilities;
  private isShuttingDown = false;
  private taskCounter = 0;
  private requestManager: RequestManager;

  private defaultRetryPolicy: WorkerRetryPolicy = {
    maxRetries: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    retryableCategories: ['timeout', 'system', 'network'],
  };

  constructor(requestManagerConfig?: Partial<RequestManagerConfig>) {
    super();
    this.capabilities = EnvironmentSniffer.getCapabilities();

    // Initialize request manager
    const defaultConfig: RequestManagerConfig = {
      defaultTimeout: 30000,
      maxConcurrentPerBank: 10,
    };

    this.requestManager = new RequestManager({
      ...defaultConfig,
      ...requestManagerConfig,
    });

    // Forward request manager events
    this.requestManager.on('request-submitted', (data) =>
      this.emit('request-submitted', data),
    );
    this.requestManager.on('request-assigned', (data) =>
      this.emit('request-assigned', data),
    );
    this.requestManager.on('request-completed', (data) =>
      this.emit('request-completed', data),
    );
    this.requestManager.on('request-failed', (data) =>
      this.emit('request-failed', data),
    );

    console.log('🔧 WorkerManager initialized:', {
      environment: this.capabilities.environment,
      webWorkers: this.capabilities.webWorkers,
      nodeWorkers: this.capabilities.nodeWorkers,
      concurrency: this.capabilities.concurrency,
    });
  }

  // ─── Worker Bank Management ────────────────────────────────────────

  /**
   * Initialize a worker bank from configuration
   */
  async initializeWorkerBank(bankConfig: IInitWorkerBank): Promise<void> {
    if (this.banks.has(bankConfig.bankId)) {
      throw new Error(`Worker bank ${bankConfig.bankId} already exists`);
    }

    const messageClass = new WorkerMessageClass(bankConfig.manifest);
    const workers = new Map<string, IWorkerLike>();

    // Create workers based on environment capabilities
    const workerIds: string[] = [];
    for (let i = 0; i < bankConfig.workerCount; i++) {
      const workerId = `${bankConfig.bankId}-worker-${i + 1}`;
      const worker = await this.createWorker(bankConfig.manifest, workerId);

      if (worker) {
        workers.set(workerId, worker);
        workerIds.push(workerId);
        this.setupWorkerHandlers(worker, workerId, bankConfig.bankId);
      }
    }

    // Create bank
    const bank: WorkerBank = {
      bankId: bankConfig.bankId,
      manifest: bankConfig.manifest,
      workers,
      messageClass,
      config: bankConfig.config || {},
    };

    this.banks.set(bankConfig.bankId, bank);

    // Register bank with request manager
    const bankRecord: Bank = {
      bankId: bankConfig.bankId,
      name: bankConfig.manifest.name,
      description: `Worker bank for ${bankConfig.manifest.name} (v${bankConfig.manifest.version})`,
      manifestName: bankConfig.manifest.name,
      workerCount: workers.size,
      status: 'active',
      config: bankConfig.config || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        totalRequestsProcessed: 0,
        averageProcessingTime: 0,
        successRate: 1.0,
        currentLoad: 0,
      },
    };

    this.requestManager.registerBank(bankRecord);

    // Register tasks and capabilities
    for (const action of bankConfig.manifest.actions) {
      // Register task definition
      const task: TaskDefinition = {
        taskId: action.actionId,
        actionId: action.actionId,
        name: action.actionId,
        description: action.description,
        category: bankConfig.manifest.name,
        estimatedDuration: action.estimatedDuration || 5000,
        parametersSchema: this.buildParametersSchema(action.parameters),
        createdAt: new Date().toISOString(),
      };

      this.requestManager.registerTask(task);

      // Register bank capability
      const capability: Omit<
        BankTaskCapability,
        'capabilityId' | 'createdAt' | 'updatedAt'
      > = {
        bankId: bankConfig.bankId,
        taskId: action.actionId,
        proficiency: 1.0, // Start with full proficiency
        averageProcessingTime: action.estimatedDuration || 5000,
        successRate: 1.0,
        currentLoad: 0,
        maxConcurrent: bankConfig.manifest.maxConcurrentTasks || 5,
      };

      this.requestManager.registerCapability(capability);
    }

    // Initialize activity tracking
    this.activityTracer.initializeBank(bankConfig.bankId, workerIds);

    this.emit('bank-initialized', {
      type: 'bank-initialized',
      bankId: bankConfig.bankId,
      data: {
        workerCount: workers.size,
        taskCount: bankConfig.manifest.actions.length,
      },
      timestamp: Date.now(),
    } as WorkerEvent);

    console.log(
      `✅ Initialized worker bank '${bankConfig.bankId}' with ${workers.size} workers and ${bankConfig.manifest.actions.length} task types`,
    );
  }

  /**
   * Create a worker based on environment capabilities
   */
  private async createWorker(
    manifest: WorkerManifest,
    workerId: string,
  ): Promise<IWorkerLike | null> {
    try {
      if (this.capabilities.webWorkers) {
        const worker = new Worker(manifest.browserWorkerPath, {
          type: 'module',
        });
        console.log(`🌐 Created browser worker: ${workerId}`);
        return worker;
      } else if (this.capabilities.nodeWorkers) {
        // Node.js worker creation would go here
        console.log(`🖥️ Node.js workers not yet implemented for: ${workerId}`);
        return null;
      } else {
        // Fall back to mock worker
        console.log(`🤖 Creating mock worker: ${workerId}`);
        return new MockWorker(
          manifest.browserWorkerPath,
          {
            processingDelay: 100,
            failureRate: 0.02,
          },
          workerId,
        );
      }
    } catch (error) {
      console.error(`Failed to create worker ${workerId}:`, error);
      return null;
    }
  }

  /**
   * Set up message and error handlers for a worker
   */
  private setupWorkerHandlers(
    worker: IWorkerLike,
    workerId: string,
    bankId: string,
  ): void {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerResponse(workerId, bankId, event.data);
    };

    worker.onerror = (error: ErrorEvent) => {
      this.handleWorkerError(workerId, bankId, error);
    };
  }

  // ─── Core Messaging API ────────────────────────────────────────────

  /**
   * Send a message and wait for response
   */
  async sendAndRespond(
    actionId: string,
    parameters: Record<string, any>,
    options?: {
      bankId?: string;
      workerId?: string;
      timeout?: number;
      retryPolicy?: Partial<WorkerRetryPolicy>;
    },
  ): Promise<WorkerResponse> {
    if (this.isShuttingDown) {
      throw new Error('WorkerManager is shutting down');
    }

    const taskId = `task-${++this.taskCounter}`;

    // Find the appropriate bank
    const bankId = options?.bankId || this.getDefaultBankForAction(actionId);
    const bank = this.banks.get(bankId);

    if (!bank) {
      throw new Error(`No worker bank found for action ${actionId}`);
    }

    // Create and validate message
    const message = bank.messageClass.createMessage(
      actionId,
      taskId,
      parameters,
      {
        targetBank: bankId,
        targetWorker: options?.workerId,
      },
    );

    // Send message and return promise
    return new Promise((resolve, reject) => {
      const timeout = options?.timeout || bank.manifest.defaultTimeout || 30000;
      const retryPolicy = {
        ...this.defaultRetryPolicy,
        ...options?.retryPolicy,
      };

      const pendingTask: PendingTask = {
        message,
        resolve,
        reject,
        retryCount: 0,
        timeout: setTimeout(() => {
          this.handleTaskTimeout(taskId);
        }, timeout),
      };

      this.pendingTasks.set(taskId, pendingTask);
      this.sendToBank(message, bankId);
    });
  }

  /**
   * Send a message to a specific worker bank
   */
  sendToBank(message: WorkerMessage, bankId?: string): void {
    const targetBankId =
      bankId ||
      message.targetBank ||
      this.getDefaultBankForAction(message.actionId);
    const bank = this.banks.get(targetBankId);

    if (!bank) {
      throw new Error(`Worker bank ${targetBankId} not found`);
    }

    // Get next available worker using activity tracer
    const recommendation = this.activityTracer.getNextWorker(targetBankId);

    if (!recommendation) {
      throw new Error(`No available workers in bank ${targetBankId}`);
    }

    const worker = bank.workers.get(recommendation.workerId);
    if (!worker) {
      throw new Error(
        `Worker ${recommendation.workerId} not found in bank ${targetBankId}`,
      );
    }

    // Record activity and send message
    this.activityTracer.recordMessageSent(
      message,
      recommendation.workerId,
      targetBankId,
    );
    worker.postMessage(message);

    this.emit('task-started', {
      type: 'task-started',
      bankId: targetBankId,
      workerId: recommendation.workerId,
      taskId: message.taskId,
      timestamp: Date.now(),
    } as WorkerEvent);

    console.log(
      `📤 Sent ${message.actionId} to ${recommendation.workerId} in bank ${targetBankId}`,
    );
  }

  // ─── Response Handling ─────────────────────────────────────────────

  private handleWorkerResponse(
    workerId: string,
    bankId: string,
    response: WorkerResponse,
  ): void {
    // Record activity
    this.activityTracer.recordMessageCompleted(response);

    // Find pending task
    const pendingTask = this.pendingTasks.get(response.taskId);
    if (!pendingTask) {
      console.warn(`Received response for unknown task: ${response.taskId}`);
      return;
    }

    // Clear timeout
    if (pendingTask.timeout) {
      clearTimeout(pendingTask.timeout);
    }

    // Remove from pending tasks
    this.pendingTasks.delete(response.taskId);

    // Handle response
    if (response.success) {
      pendingTask.resolve(response);

      this.emit('task-completed', {
        type: 'task-completed',
        bankId,
        workerId,
        taskId: response.taskId,
        data: response.payload,
        timestamp: Date.now(),
      } as WorkerEvent);

      console.log(`✅ Task ${response.taskId} completed successfully`);
    } else {
      this.handleTaskError(pendingTask, response.error);
    }
  }

  private handleWorkerError(
    workerId: string,
    bankId: string,
    error: ErrorEvent,
  ): void {
    console.error(`Worker ${workerId} in bank ${bankId} error:`, error);

    // Record error in activity tracer
    this.activityTracer.recordWorkerError(workerId, bankId, error.message);

    this.emit('worker-error', {
      type: 'worker-offline',
      bankId,
      workerId,
      data: { error: error.message },
      timestamp: Date.now(),
    } as WorkerEvent);

    // Find and fail any pending tasks for this worker
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      if (pendingTask.message.targetWorker === workerId) {
        const workerError: WorkerError = {
          code: 'WORKER_ERROR',
          message: error.message,
          category: 'system',
          retryable: true,
          timestamp: Date.now(),
        };

        this.handleTaskError(pendingTask, workerError);
        this.pendingTasks.delete(taskId);
      }
    }
  }

  private handleTaskTimeout(taskId: string): void {
    const pendingTask = this.pendingTasks.get(taskId);
    if (!pendingTask) return;

    const timeoutError: WorkerError = {
      code: 'TASK_TIMEOUT',
      message: 'Task timed out',
      category: 'timeout',
      retryable: true,
      timestamp: Date.now(),
    };

    this.handleTaskError(pendingTask, timeoutError);
    this.pendingTasks.delete(taskId);
  }

  private async handleTaskError(
    pendingTask: PendingTask,
    error?: WorkerError,
  ): void {
    if (!error) {
      pendingTask.reject(new Error('Unknown error'));
      return;
    }

    // Check if we should retry
    if (
      error.retryable &&
      pendingTask.retryCount < this.defaultRetryPolicy.maxRetries &&
      this.defaultRetryPolicy.retryableCategories.includes(error.category)
    ) {
      pendingTask.retryCount++;
      const delay = Math.min(
        this.defaultRetryPolicy.baseDelay *
          Math.pow(
            this.defaultRetryPolicy.backoffMultiplier,
            pendingTask.retryCount - 1,
          ),
        this.defaultRetryPolicy.maxDelay,
      );

      this.emit('task-retried', {
        type: 'task-retried',
        taskId: pendingTask.message.taskId,
        data: { attempt: pendingTask.retryCount, delay },
        timestamp: Date.now(),
      } as WorkerEvent);

      console.log(
        `🔄 Retrying task ${pendingTask.message.taskId} (attempt ${pendingTask.retryCount}) after ${delay}ms`,
      );

      setTimeout(() => {
        this.sendToBank(pendingTask.message);
      }, delay);

      return;
    }

    // No more retries, reject the task
    this.emit('task-failed', {
      type: 'task-failed',
      taskId: pendingTask.message.taskId,
      data: { error: error.message, code: error.code },
      timestamp: Date.now(),
    } as WorkerEvent);

    pendingTask.reject(new Error(`${error.code}: ${error.message}`));
  }

  // ─── Utility Methods ───────────────────────────────────────────────

  private getDefaultBankForAction(actionId: string): string {
    // Find first bank that supports this action
    for (const [bankId, bank] of this.banks.entries()) {
      if (bank.messageClass.getSupportedActions().includes(actionId)) {
        return bankId;
      }
    }
    throw new Error(`No worker bank supports action: ${actionId}`);
  }

  /**
   * Get status of all worker banks
   */
  getStatus() {
    const banks = Array.from(this.banks.entries()).map(([bankId, bank]) => ({
      bankId,
      workerCount: bank.workers.size,
      manifest: bank.manifest.name,
      supportedActions: bank.messageClass.getSupportedActions(),
    }));

    return {
      capabilities: this.capabilities,
      banks,
      activityReport: this.activityTracer.getLoadBalancingReport(),
      pendingTasks: this.pendingTasks.size,
      systemMetrics: this.requestManager.getSystemMetrics(),
    };
  }

  /**
   * Submit a request through the request management system
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
    return this.requestManager.submitRequest(taskId, parameters, options);
  }

  /**
   * Get request lifecycle information
   */
  getRequestLifecycle(requestId: string) {
    return this.requestManager.getRequestLifecycle(requestId);
  }

  /**
   * Query requests with filters
   */
  queryRequests(query: any) {
    return this.requestManager.queryRequests(query);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    return this.requestManager.getSystemMetrics();
  }

  // ─── Helper Methods ────────────────────────────────────────────────

  private buildParametersSchema(parameters: any[]): Record<string, any> {
    const schema: Record<string, any> = {};

    for (const param of parameters) {
      schema[param.name] = {
        type: param.type,
        required: param.required,
        description: param.description,
        defaultValue: param.defaultValue,
      };
    }

    return schema;
  }

  /**
   * Shutdown all worker banks
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Cancel all pending tasks
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      if (pendingTask.timeout) {
        clearTimeout(pendingTask.timeout);
      }
      pendingTask.reject(new Error('WorkerManager shutting down'));
    }
    this.pendingTasks.clear();

    // Terminate all workers
    for (const bank of this.banks.values()) {
      for (const worker of bank.workers.values()) {
        worker.terminate();
      }
    }

    this.banks.clear();
    this.activityTracer.reset();

    console.log('🔧 WorkerManager shutdown complete');
  }
}
