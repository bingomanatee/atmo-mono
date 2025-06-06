import { describe, expect, it, vi } from 'vitest';
import { TaskManager } from './TaskManager.ts';
import { BrowserWorkerManager } from './BrowserWorkerManager.ts';
import { TASK_MESSAGES, TASK_STATUS, WORKER_STATUS } from './constants.ts';
import { isObj } from '@wonderlandlabs/atmo-utils';
import type { MessageIF } from './types.workers.ts';

const NOOP = () => {};

class MockWorker {
  constructor() {}

  get onmessage() {
    return this._onmessage ?? NOOP;
  }

  set onmessage(fn: Function) {
    if (typeof fn === 'function') {
      this._onmessage = function (...args: any[]) {
        fn(...args);
      }.bind(this);
    }
  }

  _onmessage?: Function;
  id = '';
  terminate = vi.fn();
  tasks: string[] = [];
  fails = 0;

  postMessage(data: any) {
    if (isObj(data)) {
      switch (data.message) {
        case TASK_MESSAGES.INIT_WORKER:
          this.#bootUp(data);
          break;
        case TASK_MESSAGES.WORKER_WORK:
          this.#work(data);
          break;
      }
    }
  }

  #work(data) {
    const { content } = data;
    if (/FAIL/.test(content.name)) {
      this.fails += 1;
      if (this.fails >= 3) {
        this.fails = 0;
        return setTimeout(
          () =>
            this.onmessage?.({
              data: {
                message: TASK_MESSAGES.WORKER_RESPONSE,
                taskId: data.taskId,
                workerId: this.id,
                content: null,
                error: 'you failed',
              },
            }),
          10,
        );
      }
    }
    setTimeout(
      () =>
        this.onmessage?.({
          data: {
            message: TASK_MESSAGES.WORKER_RESPONSE,
            taskId: data.taskId,
            workerId: this.id,
            content: 'mock response',
          },
        }),
      10,
    );
  }

  #bootUpReady() {
    this.onmessage?.({
      data: {
        message: TASK_MESSAGES.WORKER_READY,
        workerId: this.id,
      },
    });
  }

  #bootUp(data: { id: string; content: string[] }) {
    this.id = data.id;
    this.tasks = data.content;
    setTimeout(() => this.#bootUpReady(), 100);
  }
}

describe('BrowserWorkerManager', () => {
  describe('gets notified of tasks', () => {
    it('should ignore a task it is not set up to manage', () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const btw = new BrowserWorkerManager({
        manager: mgr,
        configs: [{ script: 'foo/bar.js', tasks: ['alpha', 'beta'] }],
      });

      const task = mgr.addTask({ name: 'foo', params: 100 });

      expect(mgr.task(task.id)?.status).toBe(TASK_STATUS.NEW);
      expect(mgr.task(task.id)?.assignedWorker).toBeFalsy();
      expect(mgr.status()).toEqual({
        pending: [task.id],
        working: [],
        failed: [],
        active: [],
      });
    });

    it('should allow a worker to claim ', () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const btw = new BrowserWorkerManager({
        manager: mgr,
        configs: [{ script: 'foo/bar.js', tasks: ['foo', 'bar'] }],
      });

      const task = mgr.addTask({ name: 'foo', params: 100 });

      expect(mgr.task(task.id)?.status).toBe(TASK_STATUS.NEW);
      expect(mgr.task(task.id)?.assignedWorker).toBeFalsy();
      expect(mgr.status()).toEqual({
        pending: [task.id],
        working: [],
        failed: [],
        active: [],
      });
    });

    it('should execute a task', async () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const btw = new BrowserWorkerManager({
        manager: mgr,
        configs: [{ script: 'foo/bar.js', tasks: ['foo', 'bar'] }],
      });

      const seed = { name: 'foo', params: 500 };
      mgr.addTask(seed);

      await new Promise((d) => setTimeout(d, 1500));
      expect(mgr.status()).toEqual({
        pending: [],
        working: [],
        failed: [],
        active: [],
      });
    });
  });
  describe('multiple tasks', () => {
    it('handles multiple tasks in parallel', async () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const workerCount = new Map();
      const sub = mgr.events$.subscribe((evt: MessageIF) => {
        if (evt.message === TASK_MESSAGES.WORKER_RESPONSE) {
          if (workerCount.has(evt.workerId)) {
            workerCount.set(evt.workerId, workerCount.get(evt.workerId) + 1);
          } else {
            workerCount.set(evt.workerId, 1);
          }
        }
      });
      const workerManager = new BrowserWorkerManager({
        manager: mgr,
        configs: [
          { script: 'foo/bar.js', tasks: ['foo', 'bar'] },
          { script: 'foo/bar.js', tasks: ['foo', 'bar'] },
          { script: 'foo/bar.js', tasks: ['bar'] },
          { script: 'foo/bar.js', tasks: ['foo'] },
        ],
      });
      const seed = 'run many times to see if the work is distributed'.split('');
      seed.forEach(() => {
        mgr.addTask({
          name: 'foo',
          params: 100,
        });
      });

      await new Promise((done) => {
        setTimeout(done, 500);
      });
      workerManager.workers.forEach((w) => {
        expect(w.status).toBe(WORKER_STATUS.AVAILABLE);
      });

      expect(workerCount.size).toBe(3);
      let total = 0;
      for (const worked of workerCount.values()) {
        total += worked;
      }
      expect(total).toBe(seed.length);
    }, 1000);
    it('handles failed tasks', async () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const workerCount = new Map();
      const failureCount = new Map();
      const sub = mgr.events$.subscribe((evt: MessageIF) => {
        if (evt.message === TASK_MESSAGES.WORKER_RESPONSE) {
          if (evt.error) {
            if (failureCount.has(evt.workerId)) {
              failureCount.set(
                evt.workerId,
                failureCount.get(evt.workerId) + 1,
              );
            } else {
              failureCount.set(evt.workerId, 1);
            }
            return;
          }
          if (workerCount.has(evt.workerId)) {
            workerCount.set(evt.workerId, workerCount.get(evt.workerId) + 1);
          } else {
            workerCount.set(evt.workerId, 1);
          }
        }
      });
      const workerManager = new BrowserWorkerManager({
        manager: mgr,
        configs: [
          { script: 'foo/bar.js', tasks: ['FAIL-foo', 'bar'] },
          { script: 'foo/bar.js', tasks: ['FAIL-foo', 'bar'] },
          { script: 'foo/bar.js', tasks: ['bar'] },
          { script: 'foo/bar.js', tasks: ['FAIL-foo'] },
        ],
      });
      const seed = 'run many times to see if the work is distributed'.split('');
      seed.forEach(() => {
        mgr.addTask({
          name: 'FAIL-foo',
          params: 100,
        });
      });

      await new Promise((done) => {
        setTimeout(done, 500);
      });
      workerManager.workers.forEach((w) => {
        expect(w.status).toBe(WORKER_STATUS.AVAILABLE);
      });

      let fails = 0;
      for (const failed of failureCount.values()) {
        fails += failed;
      }

      expect(workerCount.size).toBe(3);
      let total = 0;
      for (const worked of workerCount.values()) {
        total += worked;
      }

      expect(fails).toBe(15);
      expect(total + fails).toBe(seed.length);
    }, 1000);
    it('funnels all the tasks to the only qualified worker', async () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const workerCount = new Map();
      const sub = mgr.events$.subscribe((evt: MessageIF) => {
        if (evt.message === TASK_MESSAGES.WORKER_RESPONSE) {
          if (workerCount.has(evt.workerId)) {
            workerCount.set(evt.workerId, workerCount.get(evt.workerId) + 1);
          } else {
            workerCount.set(evt.workerId, 1);
          }
        }
      });
      const workerManager = new BrowserWorkerManager({
        manager: mgr,
        configs: [
          { script: 'foo/bar.js', tasks: ['foo', 'bar'] },
          { script: 'foo/bar.js', tasks: ['foo', 'bar'] },
          { script: 'foo/bar.js', tasks: ['vey'] },
          { script: 'foo/bar.js', tasks: ['foo'] },
        ],
      });
      const seed = 'run many times to see if the work is distributed'.split('');
      seed.forEach(() => {
        mgr.addTask({
          name: 'vey',
          params: 100,
        });
      });

      await new Promise((done) => {
        setTimeout(done, 800);
      });
      workerManager.workers.forEach((w) => {
        expect(w.status).toBe(WORKER_STATUS.AVAILABLE);
      });

      expect(workerCount.size).toBe(1);
      let total = 0;
      for (const worked of workerCount.values()) {
        total += worked;
      }
      expect(total).toBe(seed.length);
    }, 1000);
  }, 2000);
  describe('Worker Registration', () => {
    it('should register a worker when it is ready', async () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const btw = new BrowserWorkerManager({
        manager: mgr,
        configs: [{ script: 'foo/bar.js', tasks: ['foo', 'bar'] }],
      });
      let workers = btw.workers;
      expect(workers.length).toBe(1);
      expect(workers[0].status).toBe(WORKER_STATUS.OFFLINE);

      await new Promise((done) => setTimeout(done, 1000));

      workers = btw.workers;
      expect(workers.length).toBe(1);
      expect(workers[0].status).toBe(WORKER_STATUS.AVAILABLE);
    });
  }, 1200);
});
