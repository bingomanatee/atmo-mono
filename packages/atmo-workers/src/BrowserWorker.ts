import {
  ITask,
  TaskManagerIF,
  TaskManagerMessage,
  WorkerConfig,
} from './types.workers';
import { Subscription } from 'rxjs';
import { BrowserTaskWorker } from './BrowserTaskWorker';
import {TASK_MESSAGES, WORKER_STATUS} from "./constants";

type Props = {
  manager?: TaskManagerIF;
  configs: WorkerConfig[];
};

export class BrowserWorker {
  #manager?: TaskManagerIF;
  constructor(props: Props) {
    if (props.manager) {
      this.assignManager(props.manager);
    }
    if (props.configs?.length) {
      for (const config of props.configs) {
        this.#addWorker(config);
      }
    }
  }

  #workers: Map<string, BrowserTaskWorker> = new Map();
  #addWorker(config: WorkerConfig) {
    const worker = new BrowserTaskWorker(this, config);
    this.#workers.set(worker.id, worker);
  }

  #msub?: Subscription;
  assignManager(manager: TaskManagerIF) {
    if (this.#manager) throw new Error('browser manager already has manager');
    this.#manager = manager;
    const self = this;
    this.#msub = manager.events$.subscribe((msg) => self.onMessage(msg));
  }

  onMessage(msg: TaskManagerMessage) {
    switch(msg.message) {
      case TASK_MESSAGES.NEW_TASK:
        this.onNewTask(msg.content);
    }
  }

  onNewTask(task: ITask) {
    const capableWorkers = Array.from(this.#workers.values()).filter((w) => w.tasks.includes(task.name) && w.status === WORKER_STATUS.AVAILABLE);
  }
}
