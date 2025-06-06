import { describe, expect, it, vi } from 'vitest';
import { TaskManager } from './TaskManager.ts';
import { BrowserWorkerManager } from './BrowserWorkerManager.ts';
import { TASK_MESSAGES, TASK_STATUS, WORKER_STATUS } from './constants.ts';
import { isObj } from '@wonderlandlabs/atmo-utils';
import { sortBy } from 'lodash-es';

const NOOP = () => {};

class MockWorker {
  constructor() {}

  get onmessage() {
    return this._onmessage ?? NOOP;
  }

  set onmessage(fn: Function) {
    if (typeof fn === 'function') {
      this._onmessage = function (...args: any[]) {
        console.log('---- onmessage got ', ...args);
        fn(...args);
      }.bind(this);
    }
  }

  _onmessage?: Function;
  id = '';
  terminate = vi.fn();
  tasks: string[] = [];

  postMessage(data: any) {
    // simulate worker response

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
    console.log('--- worker mock got work:', data, this);
    if (this.tasks.includes(data.content.name)) {
      console.log('task accepted');
    }
    setTimeout(() =>
      this.onmessage?.({
        data: {
          message: TASK_MESSAGES.WORKER_RESPONSE,
          taskId: data.taskId,
          workerId: this.id,
          content: 'mock response',
        },
      }),
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
    console.log('booting with ', data);
    this.tasks = data.content;
    setTimeout(() => this.#bootUpReady(), 500);
  }
}

describe('BrowserWorkerManager', () => {
  describe.only('gets notified of tasks', () => {
    it.skip('should ignore a task it is not set up to manage', () => {
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

    it.skip('should allow a worker to claim ', () => {
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

    it.only('should execute a task', async () => {
      vi.stubGlobal('Worker', MockWorker);

      const mgr = new TaskManager();
      const btw = new BrowserWorkerManager({
        manager: mgr,
        configs: [{ script: 'foo/bar.js', tasks: ['foo', 'bar'] }],
      });

      function t(obj) {
        const out = {};
        for (const k of Object.keys(obj)) {
          if (obj[k].length) {
            out[k] = obj[k];
          }
        }
        return out;
      }

      console.log('------------- starting status:', mgr.status());
      let out = [];
      mgr.events$.subscribe(({ content, ...msg }) => {
        out.push([
          msg.seq,
          '=========== mgr got ',
          JSON.stringify(msg).replace(/-[-\w]+\d[-\w]+-/g, '..'),
          '\n status = ',
          JSON.stringify(t(mgr.status())).replace(/-[-\w]+\d[-\w]+-/g, '..'),
        ]);
      });
      const seed = { name: 'foo', params: 500 };
      console.log('---- adding task', seed.name, seed.params);
      const task = mgr.addTask(seed);
      console.log('---- task added:', task.id, task.name, task.params);

      await new Promise((d) => setTimeout(d, 1500));
      console.log(sortBy(out, 0));
    });
  });
  describe.skip('Worker Registration', () => {
    it('should register a worker when it is ready', async () => {
      // console.log('---------', expect.getState().currentTestName, '-----');
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
      // console.log('----- END ----', expect.getState().currentTestName, '-----');
    });
  });
});
