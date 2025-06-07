import { Subject } from 'rxjs';
import { TASK_STATUS, WORKER_STATUS } from './constants';

export interface ITaskParams {
  name: string;
  params: any;
  onSuccess?: Function;
  onError?: Function;
}

export interface TaskIF extends ITaskParams {
  id: string;
  assignedWorker?: string;
  status: TaskStatusValue;
}

export interface TaskStatusSummary {
  failed: string[];
  working: string[];
  active: string[];
  pending: string[];
}

export interface MessageIF {
  message: string;
  fromTask?: string;
  content?: any;
  taskId?: string;
  workerId?: string;
  managerId?: string;
  error?: string;
  seq?: number;
}

export interface BrowserTaskWorkerIF {
  status: WorkerStatusValue;
  tasks: string[];
  id: string;
  claim(task: TaskIF): void;
  browserWorkerManager: BrowserWorkerManagerIF | undefined;
  listenToTaskManager(manager: TaskManagerIF): void;
  close(): void;
}

export interface TaskManagerIF {
  events$: Subject<MessageIF>;
  emit(msg: MessageIF): void;

  addTask(task: ITaskParams): void;

  deleteTask(taskId: string): void;

  updateTask(taskId: string, props: Partial<ITaskParams>): void;

  status(): TaskStatusSummary;

  close(): void;
}

export interface BrowserWorkerManagerIF {
  taskManager?: TaskManagerIF;
  assignTaskManager(mgr: TaskManagerIF): void;
  close(): void;
}

export interface ServerTaskWorkerIF {
  readonly id: string;
  readonly tasks: string[];
  readonly script: string;
  status: WorkerStatusValue;
  readonly error?: string;
  serverWorkerManager?: ServerWorkerManagerIF;
  listenToTaskManager(manager: TaskManagerIF): void;
  canDo(m: MessageIF): boolean | undefined;
  claim(task: TaskIF): void;
  close(): void;
}

export interface ServerWorkerManagerIF {
  taskManager?: TaskManagerIF;
  workers: ServerTaskWorkerIF[];
  assignTaskManager(manager: TaskManagerIF): void;
  onTask(task: TaskIF): void;
  close(): void;
}

export type WorkerConfig = {
  tasks?: string[];
  script: string;
};

export type TaskStatusKey = keyof typeof TASK_STATUS;
export type TaskStatusValue = (typeof TASK_STATUS)[TaskStatusKey];

export type WorkerStatusKey = keyof typeof WORKER_STATUS;
export type WorkerStatusValue = (typeof WORKER_STATUS)[WorkerStatusKey];
