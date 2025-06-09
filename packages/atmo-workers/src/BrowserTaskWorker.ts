import { v4 as uuidV4 } from 'uuid';
import {
  BrowserTaskWorkerIF,
  BrowserWorkerManagerIF,
  TaskIF,
  TaskManagerIF,
  MessageIF,
  WorkerConfig,
} from './types.workers';
import { TASK_MESSAGES, WORKER_STATUS } from './constants';
import { Message } from './Message';
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
    this.#worker = new Worker(script, { type: 'module' });
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
      console.log(
        `🔔 BrowserTaskWorker [${this.id}]: Received TaskManager event: ${e.message}`,
        {
          taskId: e.taskId,
          workerId: e.workerId,
          content: e.content
            ? typeof e.content === 'object'
              ? Object.keys(e.content)
              : e.content
            : 'none',
        },
      );

      switch (e.message) {
        case TASK_MESSAGES.TASK_CLAIM_GRANTED:
          console.log(
            `🎯 BrowserTaskWorker [${this.id}]: Received TASK_CLAIM_GRANTED for task ${e.taskId}`,
          );
          if (e.workerId === this.id) {
            console.log(
              `✅ BrowserTaskWorker [${this.id}]: Claim granted for me, starting work...`,
            );
            this.#startWorkingTask(e);
          } else {
            console.log(
              `⚠️ BrowserTaskWorker [${this.id}]: Claim granted for different worker: ${e.workerId}`,
            );
          }
          break;

        case TASK_MESSAGES.TASK_AVAILABLE:
          console.log(
            `📋 BrowserTaskWorker [${this.id}]: Received TASK_AVAILABLE for task ${e.taskId}`,
          );
          console.log(
            `🔍 BrowserTaskWorker [${this.id}]: Checking if I can do this task...`,
          );

          if (this.canDo(e)) {
            console.log(
              `✅ BrowserTaskWorker [${this.id}]: I can do this task! Claiming task ${e.taskId}`,
            );
            this.claim(e.content);
          } else {
            console.log(
              `❌ BrowserTaskWorker [${this.id}]: Cannot do this task`,
            );
            console.log(
              `   Status: ${this.status}, Task name: ${e.content?.name}, My tasks: [${this.tasks.join(', ')}]`,
            );
          }
          break;

        default:
          console.log(
            `📨 BrowserTaskWorker [${this.id}]: Other TaskManager event: ${e.message}`,
          );
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

      // Send only the essential data needed for the worker to complete the task
      const workData = e.content?.params || {};

      console.log(
        `🚀 BrowserTaskWorker [${this.id}]: Sending minimal work data to worker:`,
        {
          taskId: e.taskId,
          taskName: e.content?.name,
          workData: Object.keys(workData),
        },
      );

      this.#worker.postMessage({
        message: TASK_MESSAGES.WORKER_WORK,
        taskId: e.taskId,
        content: workData, // Only send the params needed for the work
        workerId: this.id,
      });
      this.browserWorkerManager?.taskManager?.emit(
        Message.forWorker(TASK_MESSAGES.WORKER_UPDATED, this.id, { new: this }),
      );
    }
  }

  claim(task: TaskIF) {
    console.log(
      `🤝 BrowserTaskWorker [${this.id}]: Attempting to claim task ${task.id} (${task.name})`,
    );

    if (this.status === WORKER_STATUS.CLOSED) {
      console.warn(
        `❌ BrowserTaskWorker [${this.id}]: Worker is closed and cannot claim tasks`,
      );
      return;
    }

    console.log(
      `📤 BrowserTaskWorker [${this.id}]: Emitting TASK_CLAIM for task ${task.id}`,
    );
    this.browserWorkerManager?.taskManager?.emit(
      Message.forTask(TASK_MESSAGES.TASK_CLAIM, task.id, undefined, this.id),
    );
  }

  #onWorkerMessage(e: any) {
    const { data } = e;
    console.log(
      `📨 BrowserTaskWorker [${this.id}]: Received message from worker:`,
      data,
    );

    if (!isObj(data)) {
      console.log(
        `❌ BrowserTaskWorker [${this.id}]: Invalid message data (not object)`,
      );
      return;
    }

    const output = data as unknown as MessageIF;
    console.log(
      `🔍 BrowserTaskWorker [${this.id}]: Processing message type: ${output.message}`,
    );

    switch (output.message) {
      case TASK_MESSAGES.WORKER_READY:
        console.log(
          `🟢 BrowserTaskWorker [${this.id}]: Worker ready - workerId: ${output.workerId}, my id: ${this.id}`,
        );
        if (output.workerId === this.id) {
          console.log(
            `✅ BrowserTaskWorker [${this.id}]: Worker ID matches, activating...`,
          );
          this.#activate();
        } else {
          console.log(
            `⚠️ BrowserTaskWorker [${this.id}]: Worker ID mismatch, not activating`,
          );
        }
        break;

      case TASK_MESSAGES.WORKER_RESPONSE:
        console.log(
          `📝 BrowserTaskWorker [${this.id}]: Worker response received`,
        );
        this.#finishTask(output);
        break;

      default:
        console.log(
          `❓ BrowserTaskWorker [${this.id}]: Unknown worker message:`,
          data,
        );
    }
  }

  #activate() {
    console.log(
      `🔄 BrowserTaskWorker [${this.id}]: Attempting to activate - current status: ${this.status}`,
    );

    if (this.status !== WORKER_STATUS.OFFLINE) {
      console.log(
        `⚠️ BrowserTaskWorker [${this.id}]: Cannot activate - not offline (status: ${this.status})`,
      );
      return;
    }

    this.status = WORKER_STATUS.AVAILABLE;
    console.log(
      `✅ BrowserTaskWorker [${this.id}]: Activated - status now: ${this.status}`,
    );

    console.log(
      `📤 BrowserTaskWorker [${this.id}]: Emitting WORKER_READY to TaskManager`,
    );
    this.browserWorkerManager?.taskManager?.emit(
      Message.forWorker(TASK_MESSAGES.WORKER_READY, this.id, this),
    );
  }

  #finishTask(output: MessageIF) {
    if (this.status === WORKER_STATUS.CLOSED) {
      return;
    }

    console.log(
      `🏁 BrowserTaskWorker [${this.id}]: Finishing task, emitting worker response`,
    );
    this.browserWorkerManager?.taskManager?.emit(output);

    this.status = WORKER_STATUS.AVAILABLE;
    console.log(
      `🔄 BrowserTaskWorker [${this.id}]: Status changed to AVAILABLE, emitting WORKER_READY`,
    );

    this.browserWorkerManager?.taskManager?.emit(
      Message.forWorker(TASK_MESSAGES.WORKER_UPDATED, this.id, { new: this }),
    );

    console.log(
      `📤 BrowserTaskWorker [${this.id}]: Emitting WORKER_READY with tasks:`,
      this.tasks,
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
