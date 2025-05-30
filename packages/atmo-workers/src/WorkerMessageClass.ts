/**
 * Worker Message Class - Handles serialization/deserialization with manifest validation
 */

import type {
  WorkerManifest,
  WorkerActionDefinition,
  WorkerActionParameter,
  WorkerMessage,
  WorkerResponse,
  WorkerError,
} from './types';

export class WorkerMessageClass {
  private manifest: WorkerManifest;
  private actionRegistry: Map<string, WorkerActionDefinition> = new Map();

  constructor(manifest: WorkerManifest) {
    this.manifest = manifest;
    this.buildActionRegistry();
  }

  /**
   * Build action registry for fast lookup
   */
  private buildActionRegistry(): void {
    this.actionRegistry.clear();
    this.manifest.actions.forEach(action => {
      this.actionRegistry.set(action.actionId, action);
    });
  }

  /**
   * Create a worker message with validation
   */
  createMessage(
    actionId: string,
    taskId: string,
    parameters: Record<string, any>,
    options?: {
      targetBank?: string;
      targetWorker?: string;
    }
  ): WorkerMessage {
    // Validate action exists
    const actionDef = this.actionRegistry.get(actionId);
    if (!actionDef) {
      throw new Error(`Unknown action: ${actionId}. Available actions: ${Array.from(this.actionRegistry.keys()).join(', ')}`);
    }

    // Validate and process parameters
    const validatedPayload = this.validateAndProcessParameters(actionDef, parameters);

    return {
      actionId,
      taskId,
      payload: validatedPayload,
      timestamp: Date.now(),
      targetBank: options?.targetBank,
      targetWorker: options?.targetWorker,
    };
  }

  /**
   * Serialize message to string
   */
  serializeMessage(message: WorkerMessage): string {
    try {
      return JSON.stringify(message);
    } catch (error) {
      throw new Error(`Failed to serialize message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deserialize message from string
   */
  deserializeMessage(messageString: string): WorkerMessage {
    try {
      const message = JSON.parse(messageString) as WorkerMessage;
      
      // Validate message structure
      this.validateMessageStructure(message);
      
      return message;
    } catch (error) {
      throw new Error(`Failed to deserialize message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Serialize response to string
   */
  serializeResponse(response: WorkerResponse): string {
    try {
      return JSON.stringify(response);
    } catch (error) {
      throw new Error(`Failed to serialize response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deserialize response from string
   */
  deserializeResponse(responseString: string): WorkerResponse {
    try {
      const response = JSON.parse(responseString) as WorkerResponse;
      
      // Validate response structure
      this.validateResponseStructure(response);
      
      return response;
    } catch (error) {
      throw new Error(`Failed to deserialize response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create an error response
   */
  createErrorResponse(
    originalMessage: WorkerMessage,
    error: Error | WorkerError,
    workerId: string,
    bankId: string,
    duration?: number
  ): WorkerResponse {
    let workerError: WorkerError;

    if ('code' in error && 'category' in error) {
      // Already a WorkerError
      workerError = error as WorkerError;
    } else {
      // Convert Error to WorkerError
      workerError = this.createWorkerError(
        'PROCESSING_ERROR',
        error.message,
        'processing',
        true,
        { originalError: error.name },
        error.stack
      );
    }

    return {
      actionId: originalMessage.actionId,
      taskId: originalMessage.taskId,
      payload: null,
      success: false,
      error: workerError,
      workerId,
      bankId,
      timestamp: Date.now(),
      duration,
    };
  }

  /**
   * Create a success response
   */
  createSuccessResponse(
    originalMessage: WorkerMessage,
    payload: any,
    workerId: string,
    bankId: string,
    duration?: number
  ): WorkerResponse {
    return {
      actionId: originalMessage.actionId,
      taskId: originalMessage.taskId,
      payload,
      success: true,
      workerId,
      bankId,
      timestamp: Date.now(),
      duration,
    };
  }

  /**
   * Create a structured worker error
   */
  createWorkerError(
    code: string,
    message: string,
    category: WorkerError['category'],
    retryable: boolean,
    details?: Record<string, any>,
    stack?: string
  ): WorkerError {
    return {
      code,
      message,
      category,
      retryable,
      details,
      stack,
      timestamp: Date.now(),
    };
  }

  /**
   * Validate action parameters
   */
  private validateAndProcessParameters(
    actionDef: WorkerActionDefinition,
    parameters: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};
    const errors: string[] = [];

    // Check each parameter definition
    for (const paramDef of actionDef.parameters) {
      const value = parameters[paramDef.name];

      // Check required parameters
      if (paramDef.required && (value === undefined || value === null)) {
        errors.push(`Required parameter '${paramDef.name}' is missing`);
        continue;
      }

      // Use default value if parameter is not provided
      if (value === undefined && paramDef.defaultValue !== undefined) {
        result[paramDef.name] = paramDef.defaultValue;
        continue;
      }

      // Skip validation if value is undefined and not required
      if (value === undefined) {
        continue;
      }

      // Type validation
      if (!this.validateParameterType(value, paramDef.type)) {
        errors.push(`Parameter '${paramDef.name}' must be of type ${paramDef.type}, got ${typeof value}`);
        continue;
      }

      // Custom validation
      if (paramDef.validator && !paramDef.validator(value)) {
        errors.push(`Parameter '${paramDef.name}' failed custom validation`);
        continue;
      }

      result[paramDef.name] = value;
    }

    // Check for unexpected parameters
    for (const key in parameters) {
      if (!actionDef.parameters.some(p => p.name === key)) {
        errors.push(`Unexpected parameter '${key}' for action '${actionDef.actionId}'`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed: ${errors.join(', ')}`);
    }

    return result;
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(value: any, expectedType: WorkerActionParameter['type']): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Validate message structure
   */
  private validateMessageStructure(message: any): void {
    const required = ['actionId', 'taskId', 'payload', 'timestamp'];
    for (const field of required) {
      if (!(field in message)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof message.actionId !== 'string') {
      throw new Error('actionId must be a string');
    }

    if (typeof message.taskId !== 'string') {
      throw new Error('taskId must be a string');
    }

    if (typeof message.timestamp !== 'number') {
      throw new Error('timestamp must be a number');
    }
  }

  /**
   * Validate response structure
   */
  private validateResponseStructure(response: any): void {
    const required = ['actionId', 'taskId', 'payload', 'success', 'workerId', 'bankId', 'timestamp'];
    for (const field of required) {
      if (!(field in response)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof response.success !== 'boolean') {
      throw new Error('success must be a boolean');
    }

    if (!response.success && !response.error) {
      throw new Error('Error response must include error information');
    }
  }

  /**
   * Get action definition
   */
  getActionDefinition(actionId: string): WorkerActionDefinition | undefined {
    return this.actionRegistry.get(actionId);
  }

  /**
   * Get all supported actions
   */
  getSupportedActions(): string[] {
    return Array.from(this.actionRegistry.keys());
  }

  /**
   * Get manifest
   */
  getManifest(): WorkerManifest {
    return this.manifest;
  }

  /**
   * Update manifest (rebuilds action registry)
   */
  updateManifest(manifest: WorkerManifest): void {
    this.manifest = manifest;
    this.buildActionRegistry();
  }
}
