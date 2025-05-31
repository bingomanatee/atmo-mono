import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager, TASK_MANAGER_EVENTS } from '../TaskManager';
import { WorkerResponder } from '../WorkerResponder';
import type { WorkerUtilities } from '../WorkerUtilities';
import { createTestUtilities } from '../WorkerUtilities';
import { createWorkerManager } from '../index';
import { firstValueFrom } from 'rxjs';

describe('WorkerResponder with Injectable Utilities', () => {
  let taskManager: TaskManager;
  let mockUtilities: WorkerUtilities;
  let workerResponder: WorkerResponder;

  beforeEach(async () => {
    taskManager = new TaskManager({ name: 'test-manager' });

    // Create mock utilities that can be controlled in tests
    mockUtilities = {
      http: {
        get: vi.fn().mockResolvedValue(new Response('{"data": "test"}')),
        post: vi.fn().mockResolvedValue(new Response('{"success": true}')),
        put: vi.fn().mockResolvedValue(new Response('{"updated": true}')),
        delete: vi.fn().mockResolvedValue(new Response('{"deleted": true}')),
      },
      fs: {
        readFile: vi.fn().mockResolvedValue('file content'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn().mockResolvedValue(undefined),
      },
      db: {
        query: vi.fn().mockResolvedValue([{ id: 1, name: 'test' }]),
        execute: vi.fn().mockResolvedValue({ affectedRows: 1 }),
        transaction: vi
          .fn()
          .mockImplementation(async (callback) => callback(mockUtilities.db)),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      worker: {
        createWorker: vi.fn(),
        terminateWorker: vi.fn(),
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    };

    workerResponder = new WorkerResponder({
      name: 'test-worker',
      utilities: mockUtilities, // Inject mock utilities
      taskHandlers: {
        'fetch-data': async (parameters, utilities) => {
          const response = await utilities.http.get(parameters.url);
          const data = await response.json();
          return { data, source: 'http' };
        },
        'process-file': async (parameters, utilities) => {
          const content = await utilities.fs.readFile(parameters.path);
          await utilities.fs.writeFile(
            parameters.outputPath,
            content.toUpperCase(),
          );
          return { processed: true, length: content.length };
        },
        'database-task': async (parameters, utilities) => {
          const results = await utilities.db.query(
            'SELECT * FROM users WHERE id = ?',
            [parameters.userId],
          );
          return { user: results[0] };
        },
        'failing-task': async () => {
          throw new Error('Simulated failure');
        },
      },
    });

    // Attach responder to task manager
    await workerResponder.attachRequestManager(taskManager);
  });

  it('should process HTTP task using injected utilities', async () => {
    const result$ = taskManager.submitRequest(
      'fetch-data',
      { url: 'https://api.example.com/data' },
      { clientId: 'test-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result).toEqual({ data: { data: 'test' }, source: 'http' });
    expect(mockUtilities.http.get).toHaveBeenCalledWith(
      'https://api.example.com/data',
    );
    expect(mockUtilities.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('confirmed and processing task: fetch-data'),
    );
  });

  it('should process file task using injected utilities', async () => {
    const result$ = taskManager.submitRequest(
      'process-file',
      { path: '/input.txt', outputPath: '/output.txt' },
      { clientId: 'test-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result).toEqual({ processed: true, length: 12 }); // 'file content'.length
    expect(mockUtilities.fs.readFile).toHaveBeenCalledWith('/input.txt');
    expect(mockUtilities.fs.writeFile).toHaveBeenCalledWith(
      '/output.txt',
      'FILE CONTENT',
    );
  });

  it('should process database task using injected utilities', async () => {
    const result$ = taskManager.submitRequest(
      'database-task',
      { userId: 123 },
      { clientId: 'test-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result).toEqual({ user: { id: 1, name: 'test' } });
    expect(mockUtilities.db.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = ?',
      [123],
    );
  });

  it('should handle task failures properly', async () => {
    const result$ = taskManager.submitRequest(
      'failing-task',
      {},
      { clientId: 'test-client' },
    );

    await expect(firstValueFrom(result$)).rejects.toThrow('Simulated failure');
    expect(mockUtilities.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed task: failing-task'),
      expect.any(Error),
    );
  });

  it('should ignore unknown tasks', async () => {
    const events: any[] = [];
    const subscription = taskManager.subscribe((event) => events.push(event));

    const result$ = taskManager.submitRequest(
      'unknown-task',
      {},
      { clientId: 'test-client' },
    );

    // Manually timeout since no responder will handle it
    setTimeout(() => {
      const submittedEvent = events.find(
        (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_SUBMITTED,
      );
      if (submittedEvent) {
        taskManager.timeoutRequest(submittedEvent.requestId);
      }
    }, 50);

    await expect(firstValueFrom(result$)).rejects.toThrow('Request timed out');
    expect(mockUtilities.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('ignoring unknown task: unknown-task'),
    );

    subscription.unsubscribe();
  });

  it('should work with multiple WorkerResponders competing', async () => {
    // Create second worker with same capabilities
    const workerResponder2 = new WorkerResponder({
      name: 'test-worker-2',
      utilities: mockUtilities,
      taskHandlers: {
        'fetch-data': async (parameters, utilities) => {
          const response = await utilities.http.get(parameters.url);
          const data = await response.json();
          return { data, source: 'http-worker-2' };
        },
      },
    });

    await workerResponder2.attachRequestManager(taskManager);

    const result$ = taskManager.submitRequest(
      'fetch-data',
      { url: 'https://api.example.com/data' },
      { clientId: 'test-client' },
    );

    const result = await firstValueFrom(result$);

    // One of the workers should have processed it
    expect(result.data).toEqual({ data: 'test' });
    expect(['http', 'http-worker-2']).toContain(result.source);
    expect(mockUtilities.http.get).toHaveBeenCalledWith(
      'https://api.example.com/data',
    );
  });

  it('should support testMode configuration', async () => {
    const testWorker = new WorkerResponder({
      name: 'test-mode-worker',
      testMode: true,
      utilities: mockUtilities,
      taskHandlers: {
        'test-task': async () => ({ result: 'test' }),
      },
    });

    await testWorker.attachRequestManager(taskManager);

    expect(mockUtilities.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('(TEST MODE)'),
    );
  });

  it('should support legacy requestReducer', async () => {
    const legacyWorker = new WorkerResponder({
      name: 'legacy-worker',
      utilities: mockUtilities,
      requestReducer: (taskId, parameters) => {
        if (taskId === 'legacy-task') {
          return { legacy: true, parameters };
        }
        throw new Error('Unknown legacy task');
      },
    });

    await legacyWorker.attachRequestManager(taskManager);

    const result$ = taskManager.submitRequest(
      'legacy-task',
      { input: 'test' },
      { clientId: 'test-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result).toEqual({
      legacy: true,
      parameters: { input: 'test' },
    });
  });

  it('should have confirm method', async () => {
    expect(typeof workerResponder.confirm).toBe('function');

    // Test that confirm method exists and can be called
    await expect(
      workerResponder.confirm('test-request', 'test-task', { test: true }),
    ).resolves.toBeUndefined();
  });

  it('should support worker script registration', () => {
    const mockWorkerScript = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };

    workerResponder.registerWorkerScript('script-task', mockWorkerScript);

    expect(mockUtilities.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Registered worker script for task: script-task'),
    );

    workerResponder.unregisterWorkerScript('script-task');

    expect(mockWorkerScript.terminate).toHaveBeenCalled();
    expect(mockUtilities.logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unregistered worker script for task: script-task',
      ),
    );
  });

  it('should work with createWorkerManager factory function', async () => {
    const {
      taskManager: factoryTaskManager,
      workerResponder: factoryWorkerResponder,
    } = createWorkerManager({
      name: 'factory-test',
      testMode: true,
      requestReducer: (taskId, parameters) => {
        if (taskId === 'factory-task') {
          return { factory: true, parameters };
        }
        throw new Error('Unknown factory task');
      },
    });

    const result$ = factoryTaskManager.submitRequest(
      'factory-task',
      { input: 'factory-test' },
      { clientId: 'factory-client' },
    );

    const result = await firstValueFrom(result$);

    expect(result).toEqual({
      factory: true,
      parameters: { input: 'factory-test' },
    });
  });
});
