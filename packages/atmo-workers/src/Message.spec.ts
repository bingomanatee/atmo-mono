import { describe, it, expect } from 'vitest';
import { Message } from './Message';

describe('Message', () => {
  describe('constructor', () => {
    it('should create a message with message and content', () => {
      const message = new Message('test-message', { data: 'test' });

      expect(message.message).toBe('test-message');
      expect(message.content).toEqual({ data: 'test' });
      expect(message.taskId).toBeUndefined();
      expect(message.workerId).toBeUndefined();
      expect(message.error).toBeUndefined();
    });

    it('should create a message with all parameters', () => {
      const message = new Message(
        'test-message',
        { data: 'test' },
        {
          taskId: 'task-123',
          workerId: 'worker-456',
          managerId: 'manager-789',
          seq: 1,
          error: 'test error',
        },
      );

      expect(message.message).toBe('test-message');
      expect(message.content).toEqual({ data: 'test' });
      expect(message.taskId).toBe('task-123');
      expect(message.workerId).toBe('worker-456');
      expect(message.managerId).toBe('manager-789');
      expect(message.seq).toBe(1);
      expect(message.error).toBe('test error');
    });

    it('should create a message with minimal parameters', () => {
      const message = new Message('simple-message');

      expect(message.message).toBe('simple-message');
      expect(message.content).toBeUndefined();
      expect(message.taskId).toBeUndefined();
      expect(message.workerId).toBeUndefined();
    });
  });

  describe('static factory methods', () => {
    it('should create task-related messages with forTask', () => {
      const message = Message.forTask(
        'TASK_COMPLETE',
        'task-123',
        { result: 42 },
        'worker-456',
      );

      expect(message.message).toBe('TASK_COMPLETE');
      expect(message.taskId).toBe('task-123');
      expect(message.content).toEqual({ result: 42 });
      expect(message.workerId).toBe('worker-456');
    });

    it('should create task messages without worker ID', () => {
      const message = Message.forTask('NEW_TASK', 'task-789', { name: 'test' });

      expect(message.message).toBe('NEW_TASK');
      expect(message.taskId).toBe('task-789');
      expect(message.content).toEqual({ name: 'test' });
      expect(message.workerId).toBeUndefined();
    });

    it('should create worker-related messages with forWorker', () => {
      const message = Message.forWorker('WORKER_READY', 'worker-123', {
        status: 'available',
      });

      expect(message.message).toBe('WORKER_READY');
      expect(message.workerId).toBe('worker-123');
      expect(message.content).toEqual({ status: 'available' });
      expect(message.taskId).toBeUndefined();
    });

    it('should create error messages with error', () => {
      const message = Message.error(
        'TASK_FAILED',
        'Division by zero',
        'task-123',
        'worker-456',
      );

      expect(message.message).toBe('TASK_FAILED');
      expect(message.error).toBe('Division by zero');
      expect(message.taskId).toBe('task-123');
      expect(message.workerId).toBe('worker-456');
      expect(message.content).toBeUndefined();
    });

    it('should create error messages without task and worker IDs', () => {
      const message = Message.error('SYSTEM_ERROR', 'System failure');

      expect(message.message).toBe('SYSTEM_ERROR');
      expect(message.error).toBe('System failure');
      expect(message.taskId).toBeUndefined();
      expect(message.workerId).toBeUndefined();
    });

    it('should create simple messages with simple', () => {
      const message = Message.simple('STATUS_UPDATE', { status: 'running' });

      expect(message.message).toBe('STATUS_UPDATE');
      expect(message.content).toEqual({ status: 'running' });
      expect(message.taskId).toBeUndefined();
      expect(message.workerId).toBeUndefined();
      expect(message.error).toBeUndefined();
    });

    it('should create simple messages without content', () => {
      const message = Message.simple('PING');

      expect(message.message).toBe('PING');
      expect(message.content).toBeUndefined();
    });
  });

  describe('utility methods', () => {
    it('should convert to plain object with toObject', () => {
      const message = new Message(
        'test-message',
        { data: 'test' },
        {
          taskId: 'task-123',
          workerId: 'worker-456',
        },
      );

      const obj = message.toObject();

      expect(obj).toEqual({
        message: 'test-message',
        content: { data: 'test' },
        taskId: 'task-123',
        workerId: 'worker-456',
        managerId: undefined,
        seq: undefined,
        error: undefined,
      });
    });

    it('should create a copy with updates using with', () => {
      const original = new Message(
        'original-message',
        { data: 'original' },
        {
          taskId: 'task-123',
        },
      );

      const updated = original.with({
        message: 'updated-message',
        content: { data: 'updated' },
        workerId: 'worker-456',
      });

      expect(original.message).toBe('original-message');
      expect(original.content).toEqual({ data: 'original' });
      expect(original.workerId).toBeUndefined();

      expect(updated.message).toBe('updated-message');
      expect(updated.content).toEqual({ data: 'updated' });
      expect(updated.taskId).toBe('task-123');
      expect(updated.workerId).toBe('worker-456');
    });
  });

  describe('immutability', () => {
    it('should have readonly properties in TypeScript', () => {
      const message = new Message('test-message', { data: 'test' });

      // In TypeScript, readonly prevents assignment at compile time
      // At runtime, the properties are still assignable but TypeScript prevents it
      expect(message.message).toBe('test-message');
      expect(message.content).toEqual({ data: 'test' });
    });

    it('should maintain property values after creation', () => {
      const message = Message.forTask('TASK_COMPLETE', 'task-123', {
        result: 42,
      });

      expect(message.message).toBe('TASK_COMPLETE');
      expect(message.taskId).toBe('task-123');
      expect(message.content).toEqual({ result: 42 });

      // Properties should remain consistent
      expect(message.message).toBe('TASK_COMPLETE');
      expect(message.taskId).toBe('task-123');
    });
  });

  describe('type compatibility', () => {
    it('should be compatible with MessageIF interface', () => {
      const message = new Message(
        'test-message',
        { data: 'test' },
        {
          taskId: 'task-123',
          workerId: 'worker-456',
          managerId: 'manager-789',
          seq: 1,
          error: 'test error',
        },
      );

      const messageIF = message.toObject();

      expect(messageIF.message).toBe('test-message');
      expect(messageIF.content).toEqual({ data: 'test' });
      expect(messageIF.taskId).toBe('task-123');
      expect(messageIF.workerId).toBe('worker-456');
      expect(messageIF.managerId).toBe('manager-789');
      expect(messageIF.seq).toBe(1);
      expect(messageIF.error).toBe('test error');
    });
  });
});
