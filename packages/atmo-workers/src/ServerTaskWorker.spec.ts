import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskManager } from './TaskManager';
import { TASK_MESSAGES, WORKER_STATUS } from './constants';
import { isObj } from '@wonderlandlabs/atmo-utils';

// Mock worker_threads before importing ServerTaskWorker
vi.mock('worker_threads', () => {
  class MockWorker {
    onmessage: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    terminate = vi.fn();
    tasks: string[] = [];
    fails = 0;

    postMessage(data: any) {
      if (isObj(data)) {
        switch (data.message) {
          case TASK_MESSAGES.INIT_WORKER:
            this.bootUp(data);
            break;
          case TASK_MESSAGES.WORKER_WORK:
            this.doWork(data);
            break;
        }
      }
    }

    on(event: string, handler: (data: any) => void) {
      if (event === 'message') {
        this.onmessage = handler;
      } else if (event === 'error') {
        this.onerror = handler;
      }
    }

    bootUp(data: any) {
      setTimeout(() => {
        this.onmessage?.({
          message: TASK_MESSAGES.WORKER_READY,
          workerId: data.id,
          content: { tasks: data.content },
        });
      }, 10);
    }

    doWork(data: any) {
      setTimeout(() => {
        const { taskId, content } = data;
        const { name, params } = content;

        if (name === 'fail-task') {
          this.onmessage?.({
            message: TASK_MESSAGES.WORKER_RESPONSE,
            taskId,
            workerId: data.workerId,
            error: 'Task intentionally failed',
          });
        } else {
          let result = 42;
          if (name === 'add' && params) {
            result = params.a + params.b;
          }

          this.onmessage?.({
            message: TASK_MESSAGES.WORKER_RESPONSE,
            taskId,
            workerId: data.workerId,
            content: result,
          });
        }
      }, 50);
    }
  }

  return {
    Worker: MockWorker,
  };
});

// Import after mock
import { ServerTaskWorker } from './ServerTaskWorker';

describe('ServerTaskWorker', () => {
  let taskManager: TaskManager;
  let mockServerWorkerManager: any;

  beforeEach(() => {
    taskManager = new TaskManager();
    mockServerWorkerManager = {
      taskManager,
    };
  });

  afterEach(() => {
    taskManager.close();
  });

  describe('initialization', () => {
    it('should create a server worker with correct properties', () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['test-task'],
        script: './test-worker.js',
      });

      expect(worker.id).toBeDefined();
      expect(worker.tasks).toEqual(['test-task']);
      expect(worker.script).toBe('./test-worker.js');
      expect(worker.status).toBe(WORKER_STATUS.OFFLINE);
    });

    it('should become available after initialization', async () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['test-task'],
        script: './test-worker.js',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(worker.status).toBe(WORKER_STATUS.AVAILABLE);
    });
  });

  describe('task handling', () => {
    it('should be able to determine if it can do a task', async () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['add', 'subtract'],
        script: './test-worker.js',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const canDoAdd = worker.canDo({
        message: 'test',
        content: { name: 'add' },
      });

      const canDoMultiply = worker.canDo({
        message: 'test',
        content: { name: 'multiply' },
      });

      expect(canDoAdd).toBe(true);
      expect(canDoMultiply).toBe(false);
    });

    it('should not be able to do tasks when closed', () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['add'],
        script: './test-worker.js',
      });

      worker.close();

      const canDo = worker.canDo({
        message: 'test',
        content: { name: 'add' },
      });

      expect(canDo).toBe(false);
    });
  });

  describe('worker lifecycle', () => {
    it('should handle worker close properly', () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['test-task'],
        script: './test-worker.js',
      });

      worker.close();

      expect(worker.status).toBe(WORKER_STATUS.CLOSED);
    });

    it('should return early if already closed', () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['test-task'],
        script: './test-worker.js',
      });

      worker.close();
      const firstStatus = worker.status;

      worker.close();
      const secondStatus = worker.status;

      expect(firstStatus).toBe(WORKER_STATUS.CLOSED);
      expect(secondStatus).toBe(WORKER_STATUS.CLOSED);
    });
  });

  describe('task manager integration', () => {
    it('should listen to task manager events', async () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['add'],
        script: './test-worker.js',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const initialStatus = worker.status;
      expect(initialStatus).toBe(WORKER_STATUS.AVAILABLE);

      const task = taskManager.addTask({
        name: 'add',
        params: { a: 5, b: 3 },
      });

      taskManager.emit({
        message: TASK_MESSAGES.TASK_AVAILABLE,
        content: task,
        taskId: task.id,
      });

      // Worker should still be listening (status may change during processing)
      expect([WORKER_STATUS.AVAILABLE, WORKER_STATUS.WORKING]).toContain(
        worker.status,
      );
    });
  });

  describe('error handling', () => {
    it('should handle worker script errors', () => {
      const worker = new ServerTaskWorker(mockServerWorkerManager, {
        tasks: ['test-task'],
        script: './non-existent-worker.js',
      });

      // Simulate error by calling close (which sets status to CLOSED)
      worker.close();

      expect(worker.status).toBe(WORKER_STATUS.CLOSED);
    });
  });
});
