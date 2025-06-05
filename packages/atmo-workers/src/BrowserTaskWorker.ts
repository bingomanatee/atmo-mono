import { v4 as uuidV4 } from 'uuid';
import { BrowserWorker } from './BrowserWorker';
import { TaskManagerIF, WorkerConfig } from './types.workers';
import { TASK_MESSAGES, WORKER_STATUS } from './constants';
import { isObj } from '@wonderlandlabs/atmo-utils';

export class BrowserTaskWorker {
  constructor(
    private manager: TaskManagerIF,
    configs: WorkerConfig,
  ) {
    const { tasks, script } = configs;
    this.script = script;
    if (tasks) this.tasks = tasks;
    this.#worker = new Worker(script);
    const self = this;
    this.#worker.onmessage = (e) => self.workerMessage(e);
    this.#worker.postMessage({
      message: TASK_MESSAGES.INIT_WORKER,
      id: this.id,
    });
  }

  #worker: Worker;
  tasks: string[] = [];
  script: string;
  status = WORKER_STATUS.OFFLINE;
  id = uuidV4();

  workerMessage(e: MessageEvent) {
    const { data } = e;
    if (!isObj(data)) {
      return;
    }
    switch (data.message) {
      case TASK_MESSAGES.WORKER_READY:
        if (data.workerId === this.id) {
          this.#activate()
        }
    }
  }

  #activate() {
    this.status = WORKER_STATUS.AVAILABLE;
    this.manager.events$.next({message: TASK_MESSAGES.WORKER_READY, taskId: this.id})
  }
}
