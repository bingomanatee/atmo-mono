import {
  BrowserTaskWorkerIF,
  BrowserWorkerManagerIF,
  TaskIF,
  TaskManagerIF,
  MessageIF,
  WorkerConfig,
} from './types.workers';
import { Subscription } from 'rxjs';
import { BrowserTaskWorker } from './BrowserTaskWorker';
import { TASK_MESSAGES, WORKER_STATUS } from './constants';
import { Message } from './Message';
import { shuffle } from 'lodash-es';

type Props = {
  manager?: TaskManagerIF;
  configs: WorkerConfig[];
};

export class BrowserWorkerManager implements BrowserWorkerManagerIF {
  taskManager?: TaskManagerIF;
  #workers: Map<string, BrowserTaskWorkerIF> = new Map();

  constructor(props: Props) {
    if (props.manager) {
      this.assignTaskManager(props.manager);
    }
    if (props.configs?.length) {
      for (const config of props.configs) {
        this.#addWorker(config);
      }
    }
  }

  get workers(): BrowserTaskWorkerIF[] {
    return Array.from(this.#workers.values());
  }

  #msub?: Subscription;

  assignTaskManager(manager: TaskManagerIF) {
    if (this.taskManager)
      throw new Error('browser manager already has manager');
    this.taskManager = manager;
    this.#workers.forEach((w: BrowserTaskWorkerIF) => {
      w.listenToTaskManager(manager);
    });
    const self = this;
    this.#msub = manager.events$.subscribe((msg) =>
      self.#onManagerMessage(msg),
    );
  }

  #onManagerMessage(msg: MessageIF) {
    switch (msg.message) {
      case TASK_MESSAGES.NEW_TASK:
        this.onTask(msg.content);
        break;

      case TASK_MESSAGES.TASK_AVAILABLE:
        this.onTask(msg.content);
        break;

      case TASK_MESSAGES.WORKER_READY:
        this.#activateWorker(msg.workerId!);
        break;

      case TASK_MESSAGES.WORKER_RESPONSE:
        this.#activateWorker(msg.workerId!);
        break;
    }
  }

  onTask(task: TaskIF) {
    const capableWorkers = Array.from(this.#workers.values()).filter(
      (w) =>
        w.tasks.includes(task.name) &&
        w.status === WORKER_STATUS.AVAILABLE &&
        w.status !== WORKER_STATUS.CLOSED,
    );

    if (capableWorkers.length) {
      const worker = shuffle(capableWorkers).pop();
      if (worker) worker.claim(task);
    }
  }

  #addWorker(config: WorkerConfig) {
    const worker = new BrowserTaskWorker(this, config);
    this.#workers.set(worker.id, worker);
  }

  #activateWorker(id: string) {
    this.#updateWorker(id, { status: WORKER_STATUS.AVAILABLE });
  }

  #updateWorker(id: string, params: Omit<Partial<BrowserTaskWorkerIF>, 'id'>) {
    const worker = this.#workers.get(id);
    if (!worker) return undefined;
    Object.assign(worker, params);
    this.taskManager?.emit(
      Message.forWorker(TASK_MESSAGES.WORKER_UPDATED, worker.id, worker),
    );
    return worker;
  }

  close() {
    this.#msub?.unsubscribe();
    this.#msub = undefined;

    this.#workers.forEach((worker) => {
      worker.close();
    });

    this.#workers.clear();
    this.taskManager = undefined;
  }
}
