import { Subject } from 'rxjs';

export interface ITaskParams {
  name: string;
  params: string;
  onSuccess: Function;
  onError: Function;
}

export interface ITask extends ITaskParams {
  id: string,
}

export type TaskManagerMessage = {
  message: string;
  fromTask?: string;
  content?: any;
  taskId?: string;
};

export interface TaskManagerIF {
  events$: Subject<TaskManagerMessage>;

  addTask(task: ITaskParams): void;

  deleteTask(taskId: string): void;

  updateTask(taskId: string, props: Partial<ITaskParams>): void;
}

export type WorkerConfig = {
  tasks?: string[];
  script: string;
};
