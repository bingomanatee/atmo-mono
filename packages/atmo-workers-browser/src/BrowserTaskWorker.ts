import { v4 as uuidV4 } from 'uuid';
import {
  BrowserTaskWorkerIF,
  BrowserWorkerManagerIF,
  TaskIF,
  TaskManagerIF,
  MessageIF,
  WorkerConfig,
  TASK_MESSAGES,
  WORKER_STATUS,
  Message,
} from '@wonderlandlabs/atmo-workers';
import { isObj } from '@wonderlandlabs/atmo-utils';
import { Subscription } from 'rxjs';

export class BrowserTaskWorker implements BrowserTaskWorkerIF {
  tasks: string[] = [];
  script: string;
  status = WORKER_STATUS.OFFLINE;
  id: string;
  readonly error?: string;
  #worker!: Worker;

  constructor(
    browserWorkerManager: BrowserWorkerManagerIF,
    configs: WorkerConfig,
  ) {
    this.id = uuidV4();
    const { tasks, script } = configs;
    this.script = script;
    if (tasks) this.tasks = tasks;
    this.#initWorker(script);
    this.browserWorkerManager = browserWorkerManager;
  }

  #initWorker(script: string) {
    const self = this;
    this.#worker = new Worker(script);
    this.#worker.onmessage = (e) => self.#onWorkerMessage(e);
    this.#worker.onerror = (e) => {
      console.error('Worker script failed to load:', script, e);

      self.browserWorkerManager?.taskManager?.emit(
        Message.forWorker(TASK_MESSAGES.WORKER_UPDATED, self.id, {
          new: self,
          error: `Failed to load worker script: ${script}`,
        }),
      );

      self.status = WORKER_STATUS.CLOSED;
      self.close();
    };
    this.#worker.postMessage({
      message: TASK_MESSAGES.INIT_WORKER,
      id: this.id,
      content: this.tasks,
    });
  }

  private _browserWorkerManager?: BrowserWorkerManagerIF;
  get browserWorkerManager(): BrowserWorkerManagerIF | undefined {
    return this._browserWorkerManager;
  }

  set browserWorkerManager(value: BrowserWorkerManagerIF | undefined) {
    this._browserWorkerManager = value;
    if (value?.taskManager) {
      this.listenToTaskManager(value.taskManager);
    }
  }

  #msub?: Subscription;

  listenToTaskManager(taskManager: TaskManagerIF) {
    this.#msub?.unsubscribe();
    this.#msub = taskManager.events$.subscribe((e: MessageIF) => {
      switch (e.message) {
        case TASK_MESSAGES.TASK_CLAIM_GRANTED:
          if (e.workerId === this.id) this.#startWorkingTask(e);
          break;

        case TASK_MESSAGES.TASK_AVAILABLE:
          if (this.canDo(e)) {
            this.claim(e.content);
          }
      }
    });
  }

  canDo(m: MessageIF) {
    if (this.status === WORKER_STATUS.CLOSED) {
      return false;
    }

    if (this.status == WORKER_STATUS.AVAILABLE) {
      const { name } = m.content;
      if (this.tasks.includes(name)) {
        return true;
      } else {
        return false;
      }
    }
  }

  #startWorkingTask(e: MessageIF) {
    if (this.status === WORKER_STATUS.CLOSED) {
      console.warn(`Worker ${this.id} is closed and cannot start tasks`);
      return;
    }

    if (this.status === WORKER_STATUS.AVAILABLE) {
      this.status = WORKER_STATUS.WORKING;
      this.#worker.postMessage({
        message: TASK_MESSAGES.WORKER_WORK,
        taskId: e.taskId,
        content: e.content,
        workerId: this.id,
      });
      this.browserWorkerManager?.taskManager?.emit(
        Message.forWorker(TASK_MESSAGES.WORKER_UPDATED, this.id, { new: this }),
      );
    }
  }

  claim(task: TaskIF) {
    if (this.status === WORKER_STATUS.CLOSED) {
      console.warn(`Worker ${this.id} is closed and cannot claim tasks`);
      return;
    }

    this.browserWorkerManager?.taskManager?.emit(
      Message.forTask(TASK_MESSAGES.TASK_CLAIM, task.id, undefined, this.id),
    );
  }

  #onWorkerMessage(e: any) {
    const { data } = e;
    if (!isObj(data)) {
      return;
    }
    const output = data as unknown as MessageIF;
    switch (output.message) {
      case TASK_MESSAGES.WORKER_READY:
        if (output.workerId === this.id) {
          this.#activate();
        }
        break;

      case TASK_MESSAGES.WORKER_RESPONSE:
        this.#finishTask(output);
        break;

      default:
        console.log('unknown worker message', data);
    }
  }

  #activate() {
    if (this.status !== WORKER_STATUS.OFFLINE) {
      return;
    }
    this.status = WORKER_STATUS.AVAILABLE;

    this.browserWorkerManager?.taskManager?.emit(
      Message.forWorker(TASK_MESSAGES.WORKER_READY, this.id, this),
    );
  }

  #finishTask(output: MessageIF) {
    if (this.status === WORKER_STATUS.CLOSED) {
      return;
    }

    this.browserWorkerManager?.taskManager?.emit(output);
    this.status = WORKER_STATUS.AVAILABLE;
    this.browserWorkerManager?.taskManager?.emit(
      Message.forWorker(TASK_MESSAGES.WORKER_UPDATED, this.id, { new: this }),
    );
    this.browserWorkerManager?.taskManager?.emit(
      Message.forWorker(TASK_MESSAGES.WORKER_READY, this.id, this),
    );
  }

  close() {
    if (this.status === WORKER_STATUS.CLOSED) {
      return;
    }

    this.#msub?.unsubscribe();
    this.#msub = undefined;

    this.#worker?.terminate();

    this.status = WORKER_STATUS.CLOSED;
    this._browserWorkerManager = undefined;
  }
}
