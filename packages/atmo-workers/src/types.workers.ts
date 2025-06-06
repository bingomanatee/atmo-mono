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

export type TaskManagerMessage = {
  message: string;
  fromTask?: string;
  content?: any;
  taskId?: string;
  workerId?: string;
  managerId?: string;
  seq?: number;
};

export interface BrowserTaskWorkerIF {
  status: WorkerStatusValue;
  tasks: string[];
  id: string;
  claim(task: TaskIF): void;
  browserWorkerManager: BrowserWorkerManagerIF;
  listenToTaskManager(manager: TaskManagerIF): void;
}

export interface TaskManagerIF {
  events$: Subject<TaskManagerMessage>;
  emit(msg: TaskManagerMessage): void;

  addTask(task: ITaskParams): void;

  deleteTask(taskId: string): void;

  updateTask(taskId: string, props: Partial<ITaskParams>): void;
}

export interface BrowserWorkerManagerIF {
  taskManager?: TaskManagerIF;
  assignTaskManager(mgr: TaskManagerIF): void;
}

export type WorkerConfig = {
  tasks?: string[];
  script: string;
};

export type TaskStatusKey = keyof typeof TASK_STATUS;
export type TaskStatusValue = (typeof TASK_STATUS)[TaskStatusKey];

export type WorkerStatusKey = keyof typeof WORKER_STATUS;
export type WorkerStatusValue = (typeof WORKER_STATUS)[WorkerStatusKey];
