import { ITaskParams, TaskIF } from './types.workers';
import { v4 as uuidV4 } from 'uuid';
import { TASK_STATUS } from './constants';

export class TaskToWork implements TaskIF {
  status = TASK_STATUS.NEW;
  id: string;
  name: string;
  params: string;
  onSuccess: Function;
  onError: Function;
  assignedWorker?: string;

  constructor(config: ITaskParams) {
    const { name, onError, onSuccess, params } = config;
    this.name = name;
    this.params = params;
    this.onError = onError;
    this.onSuccess = onSuccess;
    this.id = uuidV4();
  }
}
