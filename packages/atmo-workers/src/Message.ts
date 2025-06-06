import { MessageIF } from './types.workers';

/**
 * Parameters for Message constructor - all MessageIF properties except message and content
 */
export type MessageParams = Omit<MessageIF, 'message' | 'content'>;

/**
 * Message class for creating structured event messages
 * Provides a clean constructor interface for creating messages
 */
export class Message implements MessageIF {
  readonly message: string;
  readonly content?: any;
  readonly taskId?: string;
  readonly workerId?: string;
  readonly managerId?: string;
  readonly seq?: number;
  readonly error?: string;

  /**
   * Create a new Message instance
   * @param message - The message type/name
   * @param content - The message content/payload
   * @param params - Additional parameters (taskId, workerId, error, etc.)
   */
  constructor(message: string, content?: any, params?: MessageParams) {
    this.message = message;
    this.content = content;

    if (params) {
      this.taskId = params.taskId;
      this.workerId = params.workerId;
      this.managerId = params.managerId;
      this.seq = params.seq;
      this.error = params.error;
    }
  }

  /**
   * Create a task-related message
   */
  static forTask(
    message: string,
    taskId: string,
    content?: any,
    workerId?: string,
  ): Message {
    return new Message(message, content, { taskId, workerId });
  }

  /**
   * Create a worker-related message
   */
  static forWorker(message: string, workerId: string, content?: any): Message {
    return new Message(message, content, { workerId });
  }

  /**
   * Create an error message
   */
  static error(
    message: string,
    error: string,
    taskId?: string,
    workerId?: string,
  ): Message {
    return new Message(message, undefined, { error, taskId, workerId });
  }

  /**
   * Create a simple message with just content
   */
  static simple(message: string, content?: any): Message {
    return new Message(message, content);
  }

  /**
   * Convert to plain object (for compatibility)
   */
  toObject(): MessageIF {
    return {
      message: this.message,
      content: this.content,
      taskId: this.taskId,
      workerId: this.workerId,
      managerId: this.managerId,
      seq: this.seq,
      error: this.error,
    };
  }

  /**
   * Create a copy with additional properties
   */
  with(updates: Partial<MessageIF>): Message {
    const currentParams: MessageParams = {
      taskId: this.taskId,
      workerId: this.workerId,
      managerId: this.managerId,
      seq: this.seq,
      error: this.error,
    };

    return new Message(
      updates.message || this.message,
      updates.content !== undefined ? updates.content : this.content,
      { ...currentParams, ...updates },
    );
  }
}
