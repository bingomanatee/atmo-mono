import { Forest, ObjectCollection } from '@wonderlandlabs/forestry';
import { PROCESS_STATUS, type ProcessStatus } from '../constants/statusTypes';
import type {
  ProcessInfo as BaseProcessInfo,
  PendingTask as BasePendingTask,
} from '../types/process';

// Extend base types to handle timestamp differences
export interface ProcessInfo
  extends Omit<BaseProcessInfo, 'startTime' | 'endTime'> {
  status: ProcessStatus;
  startTime?: number; // timestamp
  endTime?: number; // timestamp
}

export interface PendingTask extends Omit<BasePendingTask, 'queuedAt'> {
  queuedAt: number; // timestamp
}

export interface AppState {
  processes: Record<string, ProcessInfo>;
  pendingTasks: Record<string, PendingTask>;
  lastUpdated: number;
}

export function createAppStateCollection(forest: Forest) {
  return new ObjectCollection<string, AppState>(
    'appState',
    {
      initial: {
        processes: {},
        pendingTasks: {},
        lastUpdated: Date.now(),
      },
    },
    {
      addProcess(collection, process: ProcessInfo) {
        collection.set('processes', {
          ...collection.value.processes,
          [process.id]: process,
        });
        collection.set('lastUpdated', Date.now());
      },
      updateProcess(collection, id: string, updates: Partial<ProcessInfo>) {
        const existing = collection.value.processes[id];
        if (existing) {
          collection.set('processes', {
            ...collection.value.processes,
            [id]: { ...existing, ...updates },
          });
          collection.set('lastUpdated', Date.now());
        }
      },
      removeProcess(collection, id: string) {
        const { [id]: removed, ...remainingProcesses } =
          collection.value.processes;
        collection.set('processes', remainingProcesses);
        collection.set('lastUpdated', Date.now());
      },
      addTask(collection, task: PendingTask) {
        collection.set('pendingTasks', {
          ...collection.value.pendingTasks,
          [task.id]: task,
        });
        collection.set('lastUpdated', Date.now());
      },
      removeTask(collection, id: string) {
        const { [id]: removed, ...remainingTasks } =
          collection.value.pendingTasks;
        collection.set('pendingTasks', remainingTasks);
        collection.set('lastUpdated', Date.now());
      },
      clearAll(collection) {
        collection.update(() => ({
          processes: {},
          pendingTasks: {},
          lastUpdated: Date.now(),
        }));
      },
      // Action selectors for computed values
      getActiveProcesses(collection) {
        return Object.values(collection.value.processes).filter(
          (p) => p.status === PROCESS_STATUS.RUNNING,
        );
      },
      getCompletedProcesses(collection) {
        return Object.values(collection.value.processes).filter(
          (p) => p.status === PROCESS_STATUS.COMPLETED,
        );
      },
      getFailedProcesses(collection) {
        return Object.values(collection.value.processes).filter(
          (p) => p.status === PROCESS_STATUS.FAILED,
        );
      },
      getHighPriorityTasks(collection) {
        return Object.values(collection.value.pendingTasks).filter(
          (t) => t.priority > 2,
        );
      },
      getProcessCount(collection) {
        return Object.keys(collection.value.processes).length;
      },
      getTaskCount(collection) {
        return Object.keys(collection.value.pendingTasks).length;
      },
    },
    forest,
  );
}
