import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskManager } from './TaskManager';
import { TASK_MESSAGES, WORKER_STATUS } from './constants';
import { isObj } from '@wonderlandlabs/atmo-utils';

// Mock worker_threads before importing
vi.mock('worker_threads', () => {
  class MockWorker {
    onmessage: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    terminate = vi.fn();

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
      }, 50);
    }
  }

  return {
    Worker: MockWorker,
  };
});

// Import after mock
import { ServerWorkerManager } from './ServerWorkerManager';

describe('ServerWorkerManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  afterEach(() => {
    taskManager.close();
  });

  describe('initialization', () => {
    it('should create a server worker manager with workers', () => {
      const manager = new ServerWorkerManager({
        configs: [
          { tasks: ['add'], script: './worker1.js' },
          { tasks: ['subtract'], script: './worker2.js' },
        ],
      });

      expect(manager.workers).toHaveLength(2);
      expect(manager.workers[0].tasks).toEqual(['add']);
      expect(manager.workers[1].tasks).toEqual(['subtract']);

      manager.close();
    });

    it('should assign task manager during construction', () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [{ tasks: ['add'], script: './worker.js' }],
      });

      expect(manager.taskManager).toBe(taskManager);
      manager.close();
    });

    it('should assign task manager after construction', () => {
      const manager = new ServerWorkerManager({
        configs: [{ tasks: ['add'], script: './worker.js' }],
      });

      expect(manager.taskManager).toBeUndefined();

      manager.assignTaskManager(taskManager);
      expect(manager.taskManager).toBe(taskManager);

      manager.close();
    });

    it('should throw error when assigning task manager twice', () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [{ tasks: ['add'], script: './worker.js' }],
      });

      expect(() => {
        manager.assignTaskManager(new TaskManager());
      }).toThrow('server manager already has manager');

      manager.close();
    });
  });

  describe('task distribution', () => {
    it('should distribute tasks to capable workers', async () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [
          { tasks: ['add', 'subtract'], script: './worker1.js' },
          { tasks: ['multiply'], script: './worker2.js' },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const addTask = taskManager.addTask({
        name: 'add',
        params: { a: 5, b: 3 },
      });

      const multiplyTask = taskManager.addTask({
        name: 'multiply',
        params: { a: 4, b: 6 },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(manager.workers[0].status).toBe(WORKER_STATUS.AVAILABLE);
      expect(manager.workers[1].status).toBe(WORKER_STATUS.AVAILABLE);

      manager.close();
    });

    it('should not assign tasks to closed workers', async () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [
          { tasks: ['add'], script: './worker1.js' },
          { tasks: ['add'], script: './worker2.js' },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      manager.workers[0].close();

      const task = taskManager.addTask({
        name: 'add',
        params: { a: 5, b: 3 },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(manager.workers[0].status).toBe(WORKER_STATUS.CLOSED);
      expect(manager.workers[1].status).toBe(WORKER_STATUS.AVAILABLE);

      manager.close();
    });
  });

  describe('worker management', () => {
    it('should handle worker ready messages', async () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [{ tasks: ['add'], script: './worker.js' }],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manager.workers[0].status).toBe(WORKER_STATUS.AVAILABLE);

      manager.close();
    });

    it('should handle worker response messages', async () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [{ tasks: ['add'], script: './worker.js' }],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      let resultReceived = false;
      const task = taskManager.addTask({
        name: 'add',
        params: { a: 5, b: 3 },
        onSuccess: (result) => {
          resultReceived = true;
          expect(result.content).toBe(8);
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(resultReceived).toBe(true);

      manager.close();
    });
  });

  describe('cleanup', () => {
    it('should close all workers when manager closes', () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [
          { tasks: ['add'], script: './worker1.js' },
          { tasks: ['subtract'], script: './worker2.js' },
        ],
      });

      const workers = manager.workers;
      manager.close();

      workers.forEach((worker) => {
        expect(worker.status).toBe(WORKER_STATUS.CLOSED);
      });

      expect(manager.workers).toHaveLength(0);
      expect(manager.taskManager).toBeUndefined();
    });

    it('should clean up properly when closed', () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [{ tasks: ['add'], script: './worker.js' }],
      });

      expect(manager.taskManager).toBe(taskManager);
      expect(manager.workers).toHaveLength(1);

      manager.close();

      expect(manager.taskManager).toBeUndefined();
      expect(manager.workers).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle tasks with no capable workers gracefully', () => {
      const manager = new ServerWorkerManager({
        manager: taskManager,
        configs: [{ tasks: ['add'], script: './worker.js' }],
      });

      expect(() => {
        const task = taskManager.addTask({
          name: 'unknown-task',
          params: {},
        });
      }).not.toThrow();

      manager.close();
    });
  });
});
