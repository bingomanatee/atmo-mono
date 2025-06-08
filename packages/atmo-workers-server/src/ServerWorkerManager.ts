import {
  ServerWorkerManagerIF,
  TaskManagerIF,
  TaskIF,
  MessageIF,
  ServerTaskWorkerIF,
  WorkerConfig,
  TASK_MESSAGES,
  WORKER_STATUS,
  Message,
} from '@wonderlandlabs/atmo-workers';
import { Subscription } from 'rxjs';
import { ServerTaskWorker } from './ServerTaskWorker';
import { shuffle } from 'lodash-es';

type Props = {
  manager?: TaskManagerIF;
  configs: WorkerConfig[];
};

export class ServerWorkerManager implements ServerWorkerManagerIF {
  taskManager?: TaskManagerIF;
  #workers: Map<string, ServerTaskWorkerIF> = new Map();
  #msub?: Subscription;

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

  get workers(): ServerTaskWorkerIF[] {
    return Array.from(this.#workers.values());
  }

  assignTaskManager(manager: TaskManagerIF) {
    if (this.taskManager) throw new Error('server manager already has manager');
    this.taskManager = manager;
    this.#workers.forEach((w: ServerTaskWorkerIF) => {
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
    const worker = new ServerTaskWorker(this, config);
    this.#workers.set(worker.id, worker);
  }

  #activateWorker(id: string) {
    this.#updateWorker(id, { status: WORKER_STATUS.AVAILABLE });
  }

  #updateWorker(id: string, params: Omit<Partial<ServerTaskWorkerIF>, 'id'>) {
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
