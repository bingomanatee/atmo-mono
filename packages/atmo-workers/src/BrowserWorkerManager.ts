import {
  BrowserTaskWorkerIF,
  BrowserWorkerManagerIF,
  TaskIF,
  TaskManagerIF,
  TaskManagerMessage,
  WorkerConfig,
} from './types.workers';
import { Subscription } from 'rxjs';
import { BrowserTaskWorker } from './BrowserTaskWorker';
import { TASK_MESSAGES, WORKER_STATUS } from './constants';
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

  get workers(): BrowserTaskWorker[] {
    return Array.from(this.#workers.values());
  }

  #msub?: Subscription;

  assignTaskManager(manager: TaskManagerIF) {
    if (this.taskManager) throw new Error('browser manager already has manager');
    this.taskManager = manager;
    this.#workers.forEach((w: BrowserTaskWorkerIF) => {
      w.listenToTaskManager(manager);
    });
    const self = this;
    this.#msub = manager.events$.subscribe((msg) =>
      self.#onManagerMessage(msg),
    );
  }

  #onManagerMessage(msg: TaskManagerMessage) {
    switch (msg.message) {
      case TASK_MESSAGES.NEW_TASK:
        console.log('new task = ', msg.taskId);
        this.onTask(msg.content);
        break;

      case TASK_MESSAGES.TASK_AVAILABLE:
        console.log('available task = ', msg.taskId);
        this.onTask(msg.content);
        break;

      case TASK_MESSAGES.WORKER_READY:
        this.#activateWorker(msg.workerId!);
        break;
    }
  }

  onTask(task: TaskIF) {
    const capableWorkers = Array.from(this.#workers.values()).filter(
      (w) =>
        w.tasks.includes(task.name) && w.status === WORKER_STATUS.AVAILABLE,
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
    return this.#updateWorker(id, { status: WORKER_STATUS.AVAILABLE });
  }

  #updateWorker(id: string, params: Omit<Partial<BrowserTaskWorkerIF>, 'id'>) {
    const worker = this.#workers.get(id);
    if (!worker) return undefined;
    Object.assign(worker, params);
    this.taskManager?.emit({
      message: TASK_MESSAGES.WORKER_UPDATED,
      workerId: worker.id,
      content: worker,
    });
    return worker;
  }
}
