import { v4 as uuidV4 } from 'uuid';
import {
  BrowserTaskWorkerIF,
  BrowserWorkerManagerIF,
  TaskIF,
  TaskManagerIF,
  TaskManagerMessage,
  WorkerConfig,
} from './types.workers';
import { TASK_MESSAGES, WORKER_STATUS } from './constants';
import { isObj } from '@wonderlandlabs/atmo-utils';
import * as console from 'node:console';
import { WebSocket } from 'vite';
import { Subscription } from 'rxjs';
import MessageEvent = WebSocket.MessageEvent;

export class BrowserTaskWorker implements BrowserTaskWorkerIF {
  tasks: string[] = [];
  script: string;
  status = WORKER_STATUS.OFFLINE;
  id: string;
  #worker: Worker;

  constructor(
    browserWorkerManager: BrowserWorkerManagerIF,
    configs: WorkerConfig,
  ) {
    this.id = uuidV4();
    const { tasks, script } = configs;
    this.script = script;
    if (tasks) this.tasks = tasks;
    this.#worker = new Worker(script);
    const self = this;
    this.#worker.onmessage = (e) => self.#onWorkerMessage(e);
    this.#worker.postMessage({
      message: TASK_MESSAGES.INIT_WORKER,
      id: this.id,
      content: this.tasks,
    });
    this.browserWorkerManager = browserWorkerManager;
  }

  private _browserWorkerManager?: BrowserWorkerManagerIF;
  get browserWorkerManager(): BrowserWorkerManagerIF {
    return this._browserWorkerManager;
  }

  set browserWorkerManager(value: BrowserWorkerManagerIF) {
    this._browserWorkerManager = value;
    if (value.taskManager) {
      this.listenToTaskManager(value.taskManager);
    } else {
      console.log('added task manager without manager yet');
    }
  }

  #msub?: Subscription;

  listenToTaskManager(taskManager: TaskManagerIF) {
    if (this.#msub) {
      this.#msub.unsubscribe();
    }
    console.log('------ listenToTaskManager subscribing');
    this.#msub = taskManager.events$.subscribe((e: TaskManagerMessage) => {
      switch (e.message) {
        case TASK_MESSAGES.TASK_CLAIM_GRANTED:
          console.log('----- worker got claim granted:', e);
          if (e.workerId === this.id) this.#startWorkingTask(e);
          else {
            console.log('worker', this.id, 'ignoring claim grant ', e.workerId);
          }
          break;
      }
    });
  }

  #startWorkingTask(e: TaskManagerMessage) {
    console.log('---- working task:', e.content);
    if (this.status === WORKER_STATUS.AVAILABLE) {
      console.log('can work task');
      this.#worker.postMessage({
        message: TASK_MESSAGES.WORKER_WORK,
        taskId: e.taskId,
        content: e.content,
        workerId: this.id,
      })
    }
  }

  claim(task: TaskIF) {
    console.log(this.id, '>>>>>>>> claiming task', task.id);
    this.browserWorkerManager.taskManager?.emit({
      message: TASK_MESSAGES.TASK_CLAIM,
      taskId: task.id,
      workerId: this.id,
    });
  }

  #onWorkerMessage(e: MessageEvent) {
    const { data } = e;
    if (!isObj(data)) {
      console.log('--- ignoring non object data:', data);
      return;
    }
    const output = data as unknown as TaskManagerMessage;
    switch (output.message) {
      case TASK_MESSAGES.WORKER_READY:
        if (output.workerId === this.id) {
          this.#activate();
        }
        break;

      case TASK_MESSAGES.WORKER_RESPONSE:
        this.#finishTask(output);

      default:
        console.log('unknown worker message', data);
    }
  }

  #acceptClaim(data: TaskManagerMessage) {
    console.log('>>>>>> worker accepting claim grant:', data);
    const task = data.content as TaskIF;
    if (this.status === WORKER_STATUS.AVAILABLE) {
      this.#worker.postMessage({
        message: TASK_MESSAGES.START_TASK,
        taskId: task.id,
        workerId: this.id,
        content: data.content,
      });
    } else {
      this.browserWorkerManager?.taskManager?.emit({
        message: TASK_MESSAGES.RELEASE_CLAIM,
        taskId: task.id,
        workerId: this.id,
      });
    }
  }

  #activate() {
    if (this.status !== WORKER_STATUS.OFFLINE) {
      return;
    }
    this.status = WORKER_STATUS.AVAILABLE;

    this.browserWorkerManager.taskManager?.emit({
      message: TASK_MESSAGES.WORKER_READY,
      workerId: this.id,
      content: this,
    });
  }

  #finishTask(output: TaskManagerMessage) {
    this.browserWorkerManager?.taskManager?.emit(output);
    this.status = WORKER_STATUS.AVAILABLE;
    this.browserWorkerManager?.taskManager?.emit({
      message: TASK_MESSAGES.WORKER_UPDATED,
      content: {new: this},
      workerId: this.id,
    });
  }
}
