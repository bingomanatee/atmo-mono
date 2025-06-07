import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager } from './TaskManager';
import { BrowserWorkerManager } from './BrowserWorkerManager';
import { BrowserTaskWorker } from './BrowserTaskWorker';

// Mock Worker for testing
class MockWorker {
  onmessage: ((e: any) => void) | null = null;
  terminated = false;

  constructor(public scriptURL: string) {}

  postMessage(data: any) {
    // Simulate worker initialization response
    if (data.message === 'init-worker') {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: {
              message: 'worker-ready',
              workerId: data.id,
              content: { tasks: data.content },
            },
          });
        }
      }, 10);
    }
  }

  terminate() {
    this.terminated = true;
    this.onmessage = null;
  }
}

describe('Cleanup and Resource Management', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
  });

  describe('TaskManager cleanup', () => {
    it('should clean up subscriptions and tasks on close()', () => {
      const taskManager = new TaskManager();

      // Add some tasks
      const task1 = taskManager.addTask({
        name: 'test-task-1',
        params: { value: 1 },
      });
      const task2 = taskManager.addTask({
        name: 'test-task-2',
        params: { value: 2 },
      });

      // Verify tasks exist
      expect(taskManager.task(task1.id)).toBeDefined();
      expect(taskManager.task(task2.id)).toBeDefined();
      expect(taskManager.status().pending).toHaveLength(2);

      // Close the task manager
      taskManager.close();

      // Verify cleanup
      expect(taskManager.task(task1.id)).toBeUndefined();
      expect(taskManager.task(task2.id)).toBeUndefined();
      expect(taskManager.status().pending).toHaveLength(0);
    });
  });

  describe('BrowserTaskWorker cleanup', () => {
    it('should terminate worker and clean up on close()', async () => {
      const taskManager = new TaskManager();
      const workerManager = new BrowserWorkerManager({
        manager: taskManager,
        configs: [
          {
            tasks: ['test-task'],
            script: '/test-worker.js',
          },
        ],
      });

      // Wait for worker to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      const workers = workerManager.workers;
      expect(workers).toHaveLength(1);

      const worker = workers[0];

      // Verify worker is available initially
      expect(worker.status).toBe('available');

      // Close the worker
      worker.close();

      // Verify worker status changed to closed
      expect(worker.status).toBe('closed');
    });
  });

  describe('BrowserWorkerManager cleanup', () => {
    it('should close all workers and clean up on close()', async () => {
      const taskManager = new TaskManager();
      const workerManager = new BrowserWorkerManager({
        manager: taskManager,
        configs: [
          {
            tasks: ['task-1'],
            script: '/worker-1.js',
          },
          {
            tasks: ['task-2'],
            script: '/worker-2.js',
          },
        ],
      });

      // Wait for workers to initialize
      await new Promise((resolve) => setTimeout(resolve, 50));

      const workers = workerManager.workers;
      expect(workers).toHaveLength(2);

      // Verify workers are available initially
      workers.forEach((worker) => {
        expect(worker.status).toBe('available');
      });

      // Close the worker manager
      workerManager.close();

      // Verify all workers are closed
      workers.forEach((worker) => {
        expect(worker.status).toBe('closed');
      });

      // Verify workers array is cleared
      expect(workerManager.workers).toHaveLength(0);

      // Verify task manager reference is cleared
      expect(workerManager.taskManager).toBeUndefined();
    });
  });

  describe('Complete system cleanup', () => {
    it('should clean up entire worker system properly', async () => {
      const taskManager = new TaskManager();
      const workerManager = new BrowserWorkerManager({
        manager: taskManager,
        configs: [
          {
            tasks: ['cleanup-test'],
            script: '/cleanup-worker.js',
          },
        ],
      });

      // Add some tasks
      const task = taskManager.addTask({
        name: 'cleanup-test',
        params: { test: true },
      });

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify system is set up
      expect(workerManager.workers).toHaveLength(1);
      expect(taskManager.task(task.id)).toBeDefined();

      // Clean up in recommended order
      workerManager.close();
      taskManager.close();

      // Verify complete cleanup
      expect(workerManager.workers).toHaveLength(0);
      expect(workerManager.taskManager).toBeUndefined();
      expect(taskManager.task(task.id)).toBeUndefined();
      expect(taskManager.status().pending).toHaveLength(0);
    });
  });
});
