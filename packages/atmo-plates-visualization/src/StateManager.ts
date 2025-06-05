import { Forest } from '@wonderlandlabs/forestry';
import { Subject } from 'rxjs';
import { MESSAGE_TYPES } from './constants/messageTypes';
import { STATUS_TYPES } from './constants/statusTypes';
import { createAppStateCollection } from './factories/createAppStateCollection';
import {
  createPlatesCollection,
  type PlateState,
} from './factories/createPlatesCollection';

// Re-export types from factories for convenience
export type {
  ProcessInfo,
  PendingTask,
  AppState,
} from './factories/createAppStateCollection';
export type { PlateState } from './factories/createPlatesCollection';

// Note: Platelets are NOT stored in global state due to volume
// Use collection iterators to access platelet data when needed

export class StateManager {
  private forest: Forest;
  public plates: ReturnType<typeof createPlatesCollection>;
  public appState: ReturnType<typeof createAppStateCollection>;
  public messageSubject = new Subject<any>(); // a broadcaster for worker feedback

  constructor() {
    // Initialize Forest as meta-controller
    this.forest = new Forest();

    // Initialize ObjectCollections using factories
    this.plates = createPlatesCollection(this.forest);
    this.appState = createAppStateCollection(this.forest);

    // Set up message subscription
    this.setupMessageSubscription();

    // Set up message traffic listening
    this.setupMessageListening();
  }

  private setupMessageSubscription(): void {
    this.messageSubject.subscribe((message) => {
      this.handleSpecificMessage(message);
    });
  }

  private setupMessageListening(): void {
    // Listen to worker messages
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });
    }

    // Listen to custom events
    document.addEventListener('atmo-state-update', (event: any) => {
      this.handleMessage(event.detail);
    });
  }

  private handleMessage(message: any): void {
    if (!message || typeof message !== 'object') return;

    // Notify all subscribers via Subject
    this.messageSubject.next(message);
  }

  private handleSpecificMessage(message: any): void {
    // Handle specific message types
    switch (message.type) {
      case MESSAGE_TYPES.PROCESS.STARTED:
        this.appState.acts.addProcess({
          id: message.processId,
          type: message.processType,
          status: STATUS_TYPES.PROCESS.RUNNING,
          plateId: message.plateId,
          startTime: Date.now(),
          details: message.details,
        });
        break;

      case MESSAGE_TYPES.PROCESS.COMPLETED:
        this.appState.acts.updateProcess(message.processId, {
          status: STATUS_TYPES.PROCESS.COMPLETED,
          endTime: Date.now(),
          progress: 1,
        });
        break;

      case MESSAGE_TYPES.PROCESS.FAILED:
        this.appState.acts.updateProcess(message.processId, {
          status: STATUS_TYPES.PROCESS.FAILED,
          endTime: Date.now(),
          error: message.error,
        });
        break;

      case MESSAGE_TYPES.TASK.QUEUED:
        this.appState.acts.addTask({
          id: message.taskId,
          type: message.taskType,
          priority: message.priority || 1,
          plateId: message.plateId,
          queuedAt: Date.now(),
          estimatedDuration: message.estimatedDuration,
          dependencies: message.dependencies,
        });
        break;

      case MESSAGE_TYPES.TASK.STARTED:
        this.appState.acts.removeTask(message.taskId);
        break;

      case MESSAGE_TYPES.PLATELET.GENERATED:
        // Don't store individual platelets in state - too much data
        // Just increment the plate's platelet count
        this.plates.acts.incrementPlateletCount(message.plateId, 1);
        break;

      case MESSAGE_TYPES.PLATE.PROGRESS:
        this.plates.acts.updateProgress(
          message.plateId,
          message.progress,
          message.plateletCount,
        );
        break;

      default:
        console.warn('unrecognized message:', message.type);
    }
  }

  // Platelets are not stored in global state - use collection iterators instead
  // Use getPlateletCount() and getPlateletInfo() methods for platelet data

  public addPlate(plate: PlateState): void {
    this.plates.set(plate.id, plate);
  }

  public updatePlate(id: string, updates: Partial<PlateState>): void {
    this.plates.acts.updatePlate(id, updates);
  }

  public dispatchCustomEvent(type: string, detail: any): void {
    const event = new CustomEvent('atmo-state-update', {
      detail: { type, ...detail },
    });
    document.dispatchEvent(event);
  }

  public clear(): void {
    this.plates.clear();
    this.appState.acts.clearAll();
  }

  public dispose(): void {
    // Complete and clean up the message subject
    this.messageSubject.complete();
  }
}
