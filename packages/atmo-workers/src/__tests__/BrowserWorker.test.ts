import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskManager } from '../TaskManager';
import { BrowserWorker } from '../BrowserWorker';
import type { WorkerManifest } from '../BrowserWorker';
import { createBrowserWorkerManager } from '../index';
import { firstValueFrom } from 'rxjs';

// Mock Worker class for testing
class MockWorker {
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  public terminated = false;

  constructor(public scriptUrl: string) {
    console.log(`🔧 MockWorker created for: ${scriptUrl}`);
  }

  postMessage(message: any) {
    console.log(`📤 MockWorker (${this.scriptUrl}) received message:`, message);
    
    // Simulate async worker response
    setTimeout(() => {
      const listeners = this.listeners.get('message');
      if (listeners && !this.terminated) {
        const responseEvent = new MessageEvent('message', {
          data: {
            type: 'task-complete',
            taskId: message.taskId,
            requestId: message.requestId,
            success: true,
            result: {
              processed: true,
              taskId: message.taskId,
              parameters: message.parameters,
              workerScript: this.scriptUrl,
              timestamp: Date.now(),
            },
          },
        });
        listeners.forEach(listener => listener(responseEvent));
      }
    }, 10);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  terminate() {
    this.terminated = true;
    this.listeners.clear();
    console.log(`🛑 MockWorker (${this.scriptUrl}) terminated`);
  }
}

// Mock window with Worker
const mockWindow = {
  Worker: MockWorker,
} as any as Window;

describe('BrowserWorker', () => {
  let taskManager: TaskManager;
  let browserWorker: BrowserWorker;
  let workerManifests: WorkerManifest[];

  beforeEach(async () => {
    taskManager = new TaskManager({ name: 'test-manager' });

    workerManifests = [
      {
        name: 'math-worker',
        scriptUrl: '/workers/math-worker.js',
        tasks: ['add', 'multiply', 'calculate'],
      },
      {
        name: 'data-worker',
        scriptUrl: '/workers/data-worker.js',
        tasks: ['fetch', 'transform', 'validate'],
      },
      {
        name: 'image-worker',
        scriptUrl: '/workers/image-worker.js',
        tasks: ['resize', 'filter', 'compress'],
      },
    ];

    browserWorker = new BrowserWorker({
      name: 'test-browser-worker',
      window: mockWindow,
      taskManager,
      workerManifests,
      maxConcurrentTasks: 2,
      workerTimeout: 5000,
    });

    await browserWorker.attachRequestManager(taskManager);
  });

  afterEach(() => {
    browserWorker.terminate();
  });

  it('should initialize workers from manifests', () => {
    const status = browserWorker.getWorkerStatus();
    
    expect(status).toHaveLength(3);
    expect(status.map(w => w.name)).toEqual(['math-worker', 'data-worker', 'image-worker']);
    expect(status.every(w => !w.busy)).toBe(true);
    expect(status.every(w => w.tasksCompleted === 0)).toBe(true);
  });

  it('should process tasks using appropriate workers', async () => {
    const result$ = taskManager.submitRequest(
      'add',
      { a: 5, b: 3 },
      { clientId: 'test-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result.processed).toBe(true);
    expect(result.taskId).toBe('add');
    expect(result.parameters).toEqual({ a: 5, b: 3 });
    expect(result.workerScript).toBe('/workers/math-worker.js');

    // Check worker status
    const status = browserWorker.getWorkerStatus();
    const mathWorker = status.find(w => w.name === 'math-worker');
    expect(mathWorker?.tasksCompleted).toBe(1);
    expect(mathWorker?.busy).toBe(false);
  });

  it('should handle multiple concurrent tasks', async () => {
    const promises = [
      firstValueFrom(taskManager.submitRequest('add', { a: 1, b: 2 }, { clientId: 'client-1' })),
      firstValueFrom(taskManager.submitRequest('fetch', { url: 'test.com' }, { clientId: 'client-2' })),
      firstValueFrom(taskManager.submitRequest('resize', { width: 100 }, { clientId: 'client-3' })),
    ];

    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    expect(results[0].workerScript).toBe('/workers/math-worker.js');
    expect(results[1].workerScript).toBe('/workers/data-worker.js');
    expect(results[2].workerScript).toBe('/workers/image-worker.js');

    // Check that all workers processed tasks
    const status = browserWorker.getWorkerStatus();
    expect(status.every(w => w.tasksCompleted === 1)).toBe(true);
  });

  it('should ignore unknown tasks', async () => {
    const events: any[] = [];
    const subscription = taskManager.subscribe((event) => events.push(event));

    const result$ = taskManager.submitRequest(
      'unknown-task',
      {},
      { clientId: 'test-client' },
    );

    // Manually timeout since no worker will handle it
    setTimeout(() => {
      const submittedEvent = events.find(
        (e) => e.type === 'request-submitted',
      );
      if (submittedEvent) {
        taskManager.timeoutRequest(submittedEvent.requestId);
      }
    }, 50);

    await expect(firstValueFrom(result$)).rejects.toThrow('Request timed out');

    subscription.unsubscribe();
  });

  it('should work with createBrowserWorkerManager factory', async () => {
    const { taskManager: factoryTaskManager, browserWorker: factoryBrowserWorker } = createBrowserWorkerManager({
      name: 'factory-test',
      window: mockWindow,
      workerManifests: [
        {
          name: 'test-worker',
          scriptUrl: '/workers/test-worker.js',
          tasks: ['test-task'],
        },
      ],
      maxConcurrentTasks: 1,
    });

    const result$ = factoryTaskManager.submitRequest(
      'test-task',
      { input: 'factory-test' },
      { clientId: 'factory-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result.processed).toBe(true);
    expect(result.taskId).toBe('test-task');
    expect(result.workerScript).toBe('/workers/test-worker.js');

    factoryBrowserWorker.terminate();
  });

  it('should provide worker status information', () => {
    const status = browserWorker.getWorkerStatus();

    expect(status).toHaveLength(3);
    
    status.forEach(worker => {
      expect(worker).toHaveProperty('id');
      expect(worker).toHaveProperty('name');
      expect(worker).toHaveProperty('busy');
      expect(worker).toHaveProperty('tasksCompleted');
      expect(worker).toHaveProperty('lastActivity');
      expect(worker).toHaveProperty('tasks');
      expect(Array.isArray(worker.tasks)).toBe(true);
    });

    const mathWorker = status.find(w => w.name === 'math-worker');
    expect(mathWorker?.tasks).toEqual(['add', 'multiply', 'calculate']);
  });

  it('should terminate all workers properly', () => {
    const status = browserWorker.getWorkerStatus();
    expect(status).toHaveLength(3);

    browserWorker.terminate();

    // After termination, status should be empty
    const statusAfter = browserWorker.getWorkerStatus();
    expect(statusAfter).toHaveLength(0);
  });

  it('should handle worker competition for same task type', async () => {
    // Create multiple workers that can handle the same task
    const competitiveManifests: WorkerManifest[] = [
      {
        name: 'worker-1',
        scriptUrl: '/workers/worker-1.js',
        tasks: ['shared-task'],
      },
      {
        name: 'worker-2',
        scriptUrl: '/workers/worker-2.js',
        tasks: ['shared-task'],
      },
    ];

    const competitiveBrowserWorker = new BrowserWorker({
      name: 'competitive-worker',
      window: mockWindow,
      taskManager,
      workerManifests: competitiveManifests,
    });

    await competitiveBrowserWorker.attachRequestManager(taskManager);

    const result$ = taskManager.submitRequest(
      'shared-task',
      { data: 'test' },
      { clientId: 'test-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result.processed).toBe(true);
    expect(result.taskId).toBe('shared-task');
    expect(['/workers/worker-1.js', '/workers/worker-2.js']).toContain(result.workerScript);

    competitiveBrowserWorker.terminate();
  });
});
