import { Subject, Subscription } from 'rxjs';
import {
  ITaskParams,
  TaskIF,
  TaskManagerIF,
  TaskManagerMessage,
} from './types.workers';
import { TASK_MESSAGES, TASK_STATUS } from './constants';
import { TaskToWork } from './TaskToWork';
import { v4 as uuidV4 } from 'uuid';

export class TaskManager implements TaskManagerIF {
  events$ = new Subject<TaskManagerMessage>();
  #sub: Subscription;
  #tasks: Map<string, TaskIF> = new Map();
  id: string;

  constructor() {
    this.id = uuidV4();
    const self = this;
    this.#sub = this.events$.subscribe((e) => self.#onEvent(e));
  }

  #seq=0;
  emit(msg: TaskManagerMessage) {
    this.events$.next({ ...msg, managerId: this.id, seq: ++this.#seq });
  }

  task(id: string) {
    return this.#tasks.get(id);
  }

  status() {
    const state = {
      failed: [],
      working: [],
      active: [],
      pending: [],
    };
    this.#tasks.forEach((task: TaskIF) => {
      switch (task.status) {
        case TASK_STATUS.WORKING:
          state.working.push(task.id);
          break;
        case TASK_STATUS.FAILED:
          state.failed.push(task.id);
          break;

        case TASK_STATUS.ACTIVE:
          state.active.push(task.id);
          break;

        default:
          state.pending.push(task.id);
      }
    });
    return state;
  }

  addTask(task: ITaskParams) {
    const pendingTask = new TaskToWork(task);
    this.#tasks.set(pendingTask.id, pendingTask);
    this.emit({
      message: TASK_MESSAGES.NEW_TASK,
      content: pendingTask,
      taskId: pendingTask.id,
    });
    return pendingTask;
  }

  deleteTask(taskId: string) {
    if (this.#tasks.has(taskId)) {
      this.#tasks.delete(taskId);
      this.emit({
        message: TASK_MESSAGES.TASK_DELETED,
        taskId,
      });
    }
  }

  updateTask(taskId: string, props: Omit<Partial<TaskIF>, 'id'>) {
    if (this.#tasks.has(taskId)) {
      const task = this.#tasks.get(taskId)!;
      const history = { ...task };
      Object.assign(task, props);
      this.emit({
        message: TASK_MESSAGES.TASK_UPDATED,
        taskId,
        content: { old: history, new: task },
      });
    } else {
      console.warn('cannot get task ', taskId);
    }
  }

  #onEvent(e: TaskManagerMessage) {
    switch (e.message) {
      case TASK_MESSAGES.TASK_CLAIM:
        this.#resolveClaim(e);
        break;

      case TASK_MESSAGES.WORKER_READY:
        this.#workerReady(e);
        break;

      case TASK_MESSAGES.WORKER_RESPONSE:
        this.#finishTask(e);
    }
  }

  #finishTask(e: TaskManagerMessage) {
    const task = this.task(e.taskId);
    if (task) {
      if (task.onSuccess) {
        task.onSuccess(e);
      }
      this.deleteTask(task.id);
      console.log('---------- TASK COMPLETE -----------')
    }
  }

  #workerReady(e: TaskManagerMessage) {
    if (Array.isArray(e.content?.tasks)) {
      const { tasks } = e.content;
      if (tasks.length) {
        const openTasks = Array.from(this.#tasks.values()).filter(
          (task) =>
            task.status === TASK_STATUS.NEW && tasks.includes(task.name),
        );
        if (openTasks.length) {
          const [openTask] = openTasks;
          this.emit({
            message: TASK_MESSAGES.TASK_AVAILABLE,
            content: openTask,
          });
        }
      }
    }
  }

  #resolveClaim(e: TaskManagerMessage) {
    const { taskId, workerId } = e;
    if (!(taskId && workerId)) {
      console.warn(
        '#rsolveClaim: bad task id',
        taskId,
        'for worker id',
        workerId,
      );
      return;
    }
    const task = this.task(taskId!);
    if (task?.assignedWorker) {
      console.log('resolveClaim: task already working', task);
      return;
    }
    console.log('---- #resolving claim for ', taskId, 'by', workerId);
    this.updateTask(taskId!, {
      status: TASK_STATUS.WORKING,
      assignedWorker: workerId,
    });

    const workingTask = this.task(taskId);
    this.emit({
      message: TASK_MESSAGES.TASK_CLAIM_GRANTED,
      taskId,
      workerId,
      content: workingTask,
    });
  }
}
