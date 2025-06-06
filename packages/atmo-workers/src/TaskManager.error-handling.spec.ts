import { describe, it, expect, beforeEach } from 'vitest';
import { pick, isEqual } from 'lodash-es';
import { TaskManager } from './TaskManager';
import { TASK_MESSAGES, TASK_STATUS } from './constants';

describe('TaskManager Error Handling', () => {
  let taskManager: TaskManager;
  let successResults: any[];
  let errorResults: any[];
  let successCount: number;
  let errorCount: number;

  beforeEach(() => {
    taskManager = new TaskManager();
    successResults = [];
    errorResults = [];
    successCount = 0;
    errorCount = 0;
  });

  describe('onSuccess callback', () => {
    it('should call onSuccess when task completes successfully', () => {
      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onSuccess: (response) => {
          successCount++;
          successResults.push(response);
        },
        onError: (response) => {
          errorCount++;
          errorResults.push(response);
        },
      });

      const successResponse = {
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        content: { result: 84 },
      };

      taskManager.emit(successResponse);

      expect(successCount).toBe(1);
      expect(successResults).toHaveLength(1);

      const relevantProps = ['message', 'taskId', 'workerId', 'content'];
      expect(
        isEqual(
          pick(successResults[0], relevantProps),
          pick(successResponse, relevantProps),
        ),
      ).toBe(true);

      expect(errorCount).toBe(0);
      expect(errorResults).toHaveLength(0);
    });

    it('should not call onSuccess when onSuccess callback is not provided', () => {
      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onError: (response) => {
          errorCount++;
          errorResults.push(response);
        },
      });

      const successResponse = {
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        content: { result: 84 },
      };

      expect(() => taskManager.emit(successResponse)).not.toThrow();
      expect(successCount).toBe(0);
      expect(errorCount).toBe(0);
    });
  });

  describe('onError callback', () => {
    it('should call onError when task fails with error message', () => {
      // Add a task with error callback
      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onSuccess: (response) => {
          successCount++;
          successResults.push(response);
        },
        onError: (response) => {
          errorCount++;
          errorResults.push(response);
        },
      });

      // Simulate error worker response
      const errorResponse = {
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        error: 'Division by zero is not allowed',
      };

      taskManager.emit(errorResponse);

      // Verify onError was called with the response
      expect(errorCount).toBe(1);
      expect(errorResults).toHaveLength(1);

      // Compare only the relevant properties (ignore managerId and seq)
      const relevantProps = ['message', 'taskId', 'workerId', 'error'];
      expect(
        isEqual(
          pick(errorResults[0], relevantProps),
          pick(errorResponse, relevantProps),
        ),
      ).toBe(true);

      expect(successCount).toBe(0);
      expect(successResults).toHaveLength(0);
    });

    it('should not call onError when onError callback is not provided', () => {
      // Add a task without error callback
      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onSuccess: (response) => {
          successCount++;
          successResults.push(response);
        },
      });

      // Simulate error worker response
      const errorResponse = {
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        error: 'Something went wrong',
      };

      // Should not throw error when onError is undefined
      expect(() => taskManager.emit(errorResponse)).not.toThrow();
      expect(successCount).toBe(0);
      expect(errorCount).toBe(0);
    });
  });

  describe('task status updates', () => {
    it('should handle successful task completion', () => {
      let completedSuccessfully = false;

      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onSuccess: (response) => {
          completedSuccessfully = true;
          successCount++;
          successResults.push(response);
        },
      });

      // Check initial status
      expect(task.status).toBe(TASK_STATUS.NEW);

      // Simulate successful response
      taskManager.emit({
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        content: { result: 84 },
      });

      // Task should be deleted after completion, so we can't check its status
      // But we can verify the success callback was called
      expect(completedSuccessfully).toBe(true);
      expect(successCount).toBe(1);
    });

    it('should handle failed task completion', () => {
      let completedWithError = false;

      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onError: (response) => {
          completedWithError = true;
          errorCount++;
          errorResults.push(response);
        },
      });

      // Check initial status
      expect(task.status).toBe(TASK_STATUS.NEW);

      // Simulate error response
      taskManager.emit({
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        error: 'Task failed',
      });

      // Task should be deleted after completion, so we can't check its status
      // But we can verify the error callback was called
      expect(completedWithError).toBe(true);
      expect(errorCount).toBe(1);
    });
  });

  describe('task lifecycle', () => {
    it('should remove task from queue after successful completion', () => {
      let taskCompleted = false;

      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onSuccess: (response) => {
          taskCompleted = true;
          successCount++;
          successResults.push(response);
        },
      });

      // Task should exist initially
      expect(taskManager.task(task.id)).toBeDefined();

      // Simulate successful completion
      taskManager.emit({
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        content: { result: 84 },
      });

      // Task should be removed after completion
      expect(taskManager.task(task.id)).toBeUndefined();
      expect(taskCompleted).toBe(true);
    });

    it('should remove task from queue after failed completion', () => {
      let taskFailed = false;

      const task = taskManager.addTask({
        name: 'test-task',
        params: { value: 42 },
        onError: (response) => {
          taskFailed = true;
          errorCount++;
          errorResults.push(response);
        },
      });

      // Task should exist initially
      expect(taskManager.task(task.id)).toBeDefined();

      // Simulate failed completion
      taskManager.emit({
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: task.id,
        workerId: 'worker-1',
        error: 'Task failed',
      });

      // Task should be removed after completion
      expect(taskManager.task(task.id)).toBeUndefined();
      expect(taskFailed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle response without taskId gracefully', () => {
      // Simulate response without taskId
      const invalidResponse = {
        message: TASK_MESSAGES.WORKER_RESPONSE,
        workerId: 'worker-1',
        content: { result: 84 },
      };

      // Should not throw error
      expect(() => taskManager.emit(invalidResponse)).not.toThrow();
    });

    it('should handle response for non-existent task gracefully', () => {
      // Simulate response for non-existent task
      const invalidResponse = {
        message: TASK_MESSAGES.WORKER_RESPONSE,
        taskId: 'non-existent-task-id',
        workerId: 'worker-1',
        content: { result: 84 },
      };

      // Should not throw error
      expect(() => taskManager.emit(invalidResponse)).not.toThrow();
    });
  });
});
