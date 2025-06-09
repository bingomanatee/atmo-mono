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

    // Global events$ subscriber to log ALL messages flowing through TaskManager
    this.events$.subscribe((e) => {
      console.log(`🌊 TaskManager Events$: ${e.message}`, {
        taskId: e.taskId,
        workerId: e.workerId,
        managerId: e.managerId,
        seq: e.seq,
        content: e.content
          ? typeof e.content === 'object'
            ? Object.keys(e.content)
            : e.content
          : 'none',
      });
    });
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
    console.log(
      `📋 TaskManager: Added task ${pendingTask.id} (${task.name}) - Total tasks: ${this.#tasks.size}`,
    );

    this.emit(
      Message.forTask(TASK_MESSAGES.NEW_TASK, pendingTask.id, pendingTask),
    );
    console.log(`📤 TaskManager: Emitted NEW_TASK event for ${pendingTask.id}`);

    // Immediately check if any available workers can handle this new task
    console.log(
      `🔍 TaskManager: Checking for immediate assignment of new task ${pendingTask.id}`,
    );
    this.#checkForImmediateAssignment(pendingTask);

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

  #checkForImmediateAssignment(newTask: TaskRequest) {
    console.log(
      `🔍 TaskManager: Looking for available workers for task ${newTask.id} (${newTask.name})`,
    );

    // Emit TASK_AVAILABLE message so workers can claim the task immediately
    console.log(
      `📤 TaskManager: Emitting TASK_AVAILABLE for immediate assignment of ${newTask.id}`,
    );
    this.emit(
      Message.forTask(TASK_MESSAGES.TASK_AVAILABLE, newTask.id, newTask),
    );
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
    console.log(
      `🔔 TaskManager: Received WORKER_READY from ${e.workerId}:`,
      e.content,
    );

    if (Array.isArray(e.content?.tasks)) {
      const { tasks } = e.content;
      console.log(
        `🔍 TaskManager: Worker ${e.workerId} supports tasks:`,
        tasks,
      );

      if (tasks.length) {
        const taskList = Array.from(this.#tasks.values());
        const openTasks = taskList.filter(
          (task) =>
            task.status === TASK_STATUS.NEW && tasks.includes(task.name),
        );

        // Debug: Show task matching details
        console.log(`🔍 TaskManager: Task matching analysis:`, {
          workerSupportedTasks: tasks,
          allTaskNames: taskList.map((t) => t.name),
          newTaskNames: taskList
            .filter((t) => t.status === TASK_STATUS.NEW)
            .map((t) => t.name),
          matchingTaskNames: openTasks.map((t) => t.name),
        });

        console.log(
          `📊 TaskManager: Found ${openTasks.length} open tasks matching worker capabilities`,
        );
        console.log(
          `📊 TaskManager: Total tasks: ${taskList.length}, Open tasks: ${taskList.filter((t) => t.status === TASK_STATUS.NEW).length}`,
        );

        // Debug: Show all tasks and their details
        console.log(
          `🔍 TaskManager: All tasks in manager:`,
          taskList.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            assignedWorker: t.assignedWorker,
          })),
        );

        console.log(
          `🔍 TaskManager: Open tasks details:`,
          openTasks.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
          })),
        );

        if (openTasks.length) {
          const [openTask] = openTasks;
          console.log(
            `🎯 TaskManager: Assigning task ${openTask.id} (${openTask.name}) to worker ${e.workerId}`,
          );

          console.log(
            `🚀 TaskManager: About to emit TASK_AVAILABLE for ${openTask.id}...`,
          );
          this.emit(
            Message.forTask(
              TASK_MESSAGES.TASK_AVAILABLE,
              openTask.id,
              openTask,
            ),
          );
          console.log(
            `📤 TaskManager: Successfully emitted TASK_AVAILABLE for ${openTask.id}`,
          );
        } else {
          console.log(
            `⏸️ TaskManager: No matching open tasks for worker ${e.workerId}`,
          );
        }
      }
    } else {
      console.log(
        `❌ TaskManager: Invalid worker-ready message from ${e.workerId} - no tasks array`,
      );
    }
  }

  #resolveClaim(e: MessageIF) {
    const { taskId, workerId } = e;
    console.log(
      `🤝 TaskManager: Received TASK_CLAIM from worker ${workerId} for task ${taskId}`,
    );

    if (!(taskId && workerId)) {
      console.log(`❌ TaskManager: Invalid claim - missing taskId or workerId`);
      return;
    }

    const task = this.task(taskId!);
    if (!task) {
      console.log(`❌ TaskManager: Task ${taskId} not found for claim`);
      return;
    }

    if (task?.assignedWorker) {
      console.log(
        `⚠️ TaskManager: Task ${taskId} already assigned to worker ${task.assignedWorker}`,
      );
      return;
    }

    console.log(
      `✅ TaskManager: Granting task ${taskId} to worker ${workerId}`,
    );
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
    console.log(
      `📤 TaskManager: Emitted TASK_CLAIM_GRANTED for ${taskId} to worker ${workerId}`,
    );
  }
}
