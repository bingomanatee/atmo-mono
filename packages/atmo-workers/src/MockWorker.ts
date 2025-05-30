/**
 * Mock Worker implementation for testing and environments without worker support
 */

import type { IWorkerLike, MockWorkerConfig, WorkerMessage, WorkerResponse } from './types';

export class MockWorker implements IWorkerLike {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  
  private config: MockWorkerConfig;
  private isTerminated = false;
  private workerId: string;
  private tasksProcessed = 0;
  private startTime = Date.now();

  constructor(
    scriptPath: string, 
    config: MockWorkerConfig = { processingDelay: 100, failureRate: 0 },
    workerId: string = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  ) {
    this.config = config;
    this.workerId = workerId;
    
    console.log(`🤖 MockWorker created: ${workerId} (script: ${scriptPath})`);
  }

  /**
   * Post message to mock worker
   */
  postMessage(message: any): void {
    if (this.isTerminated) {
      console.warn(`MockWorker ${this.workerId} is terminated, ignoring message`);
      return;
    }

    // Simulate async processing
    setTimeout(() => {
      this.processMessage(message);
    }, 0);
  }

  /**
   * Terminate the mock worker
   */
  terminate(): void {
    this.isTerminated = true;
    console.log(`🤖 MockWorker terminated: ${this.workerId}`);
  }

  /**
   * Process incoming message
   */
  private async processMessage(message: WorkerMessage): Promise<void> {
    if (this.isTerminated) return;

    const startTime = Date.now();

    try {
      // Simulate processing delay
      if (this.config.processingDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.processingDelay));
      }

      // Simulate random failures
      if (Math.random() < this.config.failureRate) {
        throw new Error(`Simulated failure in MockWorker ${this.workerId}`);
      }

      // Generate response
      let responsePayload: any;
      
      if (this.config.responseGenerator) {
        responsePayload = this.config.responseGenerator(message);
      } else {
        responsePayload = this.generateDefaultResponse(message);
      }

      const duration = Date.now() - startTime;
      this.tasksProcessed++;

      const response: WorkerResponse = {
        actionId: message.actionId,
        taskId: message.taskId,
        payload: responsePayload,
        success: true,
        workerId: this.workerId,
        bankId: 'mock-bank',
        timestamp: Date.now(),
        duration,
      };

      // Send response back
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: response }));
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Send error response
      const errorResponse: WorkerResponse = {
        actionId: message.actionId,
        taskId: message.taskId,
        payload: null,
        success: false,
        error: {
          code: 'MOCK_ERROR',
          message: error instanceof Error ? error.message : String(error),
          category: 'processing',
          retryable: true,
          timestamp: Date.now(),
        },
        workerId: this.workerId,
        bankId: 'mock-bank',
        timestamp: Date.now(),
        duration,
      };

      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: errorResponse }));
      }
    }
  }

  /**
   * Generate default response based on action
   */
  private generateDefaultResponse(message: WorkerMessage): any {
    switch (message.actionId) {
      case 'PING':
        return {
          type: 'PONG',
          message: message.payload.message || 'pong',
          timestamp: Date.now(),
          workerId: this.workerId,
        };
      
      case 'GET_WORKER_STATUS':
        return {
          type: 'WORKER_STATUS',
          workerId: this.workerId,
          uptime: Date.now() - this.startTime,
          tasksProcessed: this.tasksProcessed,
          averageTaskDuration: this.config.processingDelay,
          memoryUsage: {
            used: Math.floor(Math.random() * 50) + 10, // 10-60 MB
            total: 100,
          },
        };
      
      default:
        return {
          type: 'UNKNOWN_ACTION',
          originalAction: message.actionId,
          message: `MockWorker ${this.workerId} doesn't know how to handle action: ${message.actionId}`,
        };
    }
  }

  /**
   * Get worker ID
   */
  getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Check if worker is terminated
   */
  isWorkerTerminated(): boolean {
    return this.isTerminated;
  }

  /**
   * Update mock worker configuration
   */
  updateConfig(config: Partial<MockWorkerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      workerId: this.workerId,
      tasksProcessed: this.tasksProcessed,
      uptime: Date.now() - this.startTime,
      isTerminated: this.isTerminated,
      config: this.config,
    };
  }
}

/**
 * Mock Worker Factory for creating multiple mock workers
 */
export class MockWorkerFactory {
  private static workerCounter = 0;

  /**
   * Create a mock worker
   */
  static createWorker(
    scriptPath: string,
    config?: MockWorkerConfig,
    workerId?: string
  ): MockWorker {
    const id = workerId || `mock-worker-${++this.workerCounter}`;
    return new MockWorker(scriptPath, config, id);
  }

  /**
   * Create multiple mock workers
   */
  static createWorkerBank(
    scriptPath: string,
    count: number,
    config?: MockWorkerConfig,
    bankId: string = 'mock-bank'
  ): MockWorker[] {
    const workers: MockWorker[] = [];
    
    for (let i = 0; i < count; i++) {
      const workerId = `${bankId}-worker-${i + 1}`;
      workers.push(this.createWorker(scriptPath, config, workerId));
    }
    
    return workers;
  }

  /**
   * Reset worker counter
   */
  static resetCounter(): void {
    this.workerCounter = 0;
  }
}
