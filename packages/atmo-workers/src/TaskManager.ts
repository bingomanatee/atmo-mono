import { v4 as uuidV4 } from 'uuid';
import { Subject } from 'rxjs';
import {TaskManagerIF, TaskManagerMessage, ITaskParams} from "./types.workers";
import {TASK_MESSAGES} from "./constants";

const TASK_STATUS = {
  NEW: 'new',
  WORKING: 'working',
  FAILED: 'failed',
  DONE: 'done',
};

class PendingTask implements ITaskParams {
  constructor(config: ITaskParams) {
    const { name, onError, onSuccess, params } = config;
    this.name = name;
    this.params = params;
    this.onError = onError;
    this.onSuccess = onSuccess;
    this.id = uuidV4();
  }

  status = TASK_STATUS.NEW;
  id: string;
  name: string;
  params: string;
  onSuccess: Function;
  onError: Function;
}

export class TaskManager implements TaskManagerIF {
  constructor() {}

  events$ = new Subject<TaskManagerMessage>();
  #tasks: Map<string, PendingTask> = new Map();

  addTask(task: ITaskParams) {
    const pendingTask = new PendingTask(task);
    this.#tasks.set(pendingTask.id, pendingTask);
    this.events$.next({
      message: TASK_MESSAGES.NEW_TASK,
      content: pendingTask,
    });
  }

  deleteTask(taskId: string) {
    if (this.#tasks.has(taskId)) {
      this.#tasks.delete(taskId);
      this.events$.next({
        message: TASK_MESSAGES.TASK_DELETED,
        taskId,
      });
    }
  }

  updateTask(taskId: string, props: Partial<ITaskParams>) {
    if (this.#tasks.has(taskId)) {
      const task = this.#tasks.get(taskId)!;
      const history = { ...task };
      Object.assign(task, props);
      this.events$.next({
        message: TASK_MESSAGES.TASK_UPDATED,
        taskId,
        content: { old: history, new: task },
      });
    } else {
      console.warn('cannot get task ', taskId);
    }
  }
}
