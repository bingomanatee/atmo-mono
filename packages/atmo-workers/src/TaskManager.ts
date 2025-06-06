import { Subject, Subscription } from 'rxjs';
import {
  ITaskParams,
  MessageIF,
  TaskIF,
  TaskManagerIF,
  TaskStatusSummary,
} from './types.workers';
import { TASK_MESSAGES, TASK_STATUS } from './constants';
import { TaskRequest } from './TaskRequest';
import { Message } from './Message';
import { v4 as uuidV4 } from 'uuid';

export class TaskManager implements TaskManagerIF {
  events$ = new Subject<MessageIF>();
  #sub: Subscription;
  #tasks: Map<string, TaskIF> = new Map();
  id: string;

  constructor() {
    this.id = uuidV4();
    const self = this;
    this.#sub = this.events$.subscribe((e) => self.#onEvent(e));
  }

  #seq = 0;
  #closed = false;

  emit(msg: MessageIF) {
    this.events$.next({ ...msg, managerId: this.id, seq: ++this.#seq });
  }

  close() {
    if (this.#closed) {
      return;
    }

    this.#closed = true;

    this.#sub?.unsubscribe();
    this.events$.complete();
    this.#tasks.clear();
  }

  task(id: string) {
    return this.#tasks.get(id);
  }

  status(): TaskStatusSummary {
    const state: TaskStatusSummary = {
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
    if (this.#closed) {
      throw new Error('Cannot add task: TaskManager has been closed');
    }

    const pendingTask = new TaskRequest(task);
    this.#tasks.set(pendingTask.id, pendingTask);
    this.emit(
      Message.forTask(TASK_MESSAGES.NEW_TASK, pendingTask.id, pendingTask),
    );
    return pendingTask;
  }

  deleteTask(taskId: string) {
    if (this.#tasks.has(taskId)) {
      this.#tasks.delete(taskId);
      this.emit(Message.forTask(TASK_MESSAGES.TASK_DELETED, taskId));
    }
  }

  updateTask(taskId: string, props: Omit<Partial<TaskIF>, 'id'>) {
    if (this.#tasks.has(taskId)) {
      const task = this.#tasks.get(taskId)!;
      const history = { ...task };
      Object.assign(task, props);
      this.emit(
        Message.forTask(TASK_MESSAGES.TASK_UPDATED, taskId, {
          old: history,
          new: task,
        }),
      );
    } else {
      console.warn('cannot get task ', taskId);
    }
  }

  #onEvent(e: MessageIF) {
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

  #finishTask(e: MessageIF) {
    if (!e.taskId) {
      return;
    }
    const task = this.task(e.taskId);
    if (task) {
      if (e.error) {
        task.onError?.(e);
      } else {
        task.onSuccess?.(e);
      }
      this.deleteTask(task.id);
    }
  }

  #workerReady(e: MessageIF) {
    if (Array.isArray(e.content?.tasks)) {
      const { tasks } = e.content;
      if (tasks.length) {
        const taskList = Array.from(this.#tasks.values());
        const openTasks = taskList.filter(
          (task) =>
            task.status === TASK_STATUS.NEW && tasks.includes(task.name),
        );

        if (openTasks.length) {
          const [openTask] = openTasks;
          this.emit(
            Message.forTask(
              TASK_MESSAGES.TASK_AVAILABLE,
              openTask.id,
              openTask,
            ),
          );
        }
      }
    }
  }

  #resolveClaim(e: MessageIF) {
    const { taskId, workerId } = e;
    if (!(taskId && workerId)) {
      return;
    }
    const task = this.task(taskId!);
    if (task?.assignedWorker) {
      return;
    }
    this.updateTask(taskId!, {
      status: TASK_STATUS.WORKING,
      assignedWorker: workerId,
    });

    const workingTask = this.task(taskId);
    this.emit(
      Message.forTask(
        TASK_MESSAGES.TASK_CLAIM_GRANTED,
        taskId,
        workingTask,
        workerId,
      ),
    );
  }
}
