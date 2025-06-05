import { globalStateManager } from './globalState';
import { MessageInterceptor } from './MessageInterceptor';
import { MESSAGE_TYPES } from './constants/messageTypes';
import { STATUS_TYPES } from './constants/statusTypes';
import { GlobalInstanceChecker } from './debug/GlobalInstanceChecker';

export class ProcessMonitor {
  private messageInterceptor: MessageInterceptor;
  private isInitialized: boolean = false;

  constructor() {
    this.messageInterceptor = new MessageInterceptor();
    this.setupIntegration();
  }

  private setupIntegration(): void {
    // Connect message interceptor to state manager
    this.messageInterceptor.addListener((message) => {
      this.handleInterceptedMessage(message);
    });

    // Add custom patterns for atmo-plates specific messages
    this.addAtmoPlatesPatterns();

    // Set up periodic state updates
    this.setupPeriodicUpdates();

    this.isInitialized = true;
  }

  private addAtmoPlatesPatterns(): void {
    // PlateletManager specific patterns
    this.messageInterceptor.addPattern({
      pattern: /PlateletManager.*initialized.*workers? (enabled|disabled)/i,
      type: 'platelet-manager-initialized',
      extractor: (message, match) => ({
        workersEnabled: match![1] === 'enabled',
        timestamp: new Date(),
      }),
    });

    // PlateSimulation patterns
    this.messageInterceptor.addPattern({
      pattern: /PlateSimulation.*(\d+) plates/,
      type: 'plate-simulation-setup',
      extractor: (message, match) => ({
        plateCount: parseInt(match![1]),
        timestamp: new Date(),
      }),
    });

    // Multiverse/IDBSun patterns
    this.messageInterceptor.addPattern({
      pattern: /IDBSun.*(\w+).*(\d+) records/,
      type: 'database-status',
      extractor: (message, match) => ({
        collection: match![1],
        recordCount: parseInt(match![2]),
        timestamp: new Date(),
      }),
    });

    // ThreeJS visualization patterns
    this.messageInterceptor.addPattern({
      pattern: /Visualizer.*(\d+) platelets.*plate (\w+)/,
      type: 'visualization-update',
      extractor: (message, match) => ({
        plateletCount: parseInt(match![1]),
        plateId: match![2],
        timestamp: new Date(),
      }),
    });

    // Performance patterns
    this.messageInterceptor.addPattern({
      pattern: /Generation.*(\d+\.?\d*)\s*ms/,
      type: 'performance-metric',
      extractor: (message, match) => ({
        metric: 'generation-time',
        value: parseFloat(match![1]),
        unit: 'ms',
        timestamp: new Date(),
      }),
    });

    // Edge detection patterns
    this.messageInterceptor.addPattern({
      pattern: /Edge detection.*(\d+) platelets.*flagged/,
      type: 'edge-detection-complete',
      extractor: (message, match) => ({
        flaggedCount: parseInt(match![1]),
        timestamp: new Date(),
      }),
    });
  }

  private handleInterceptedMessage(message: any): void {
    switch (message.type) {
      case MESSAGE_TYPES.PLATELET.GENERATION_COMPLETE:
        this.handlePlateletGenerationComplete(message);
        break;

      case MESSAGE_TYPES.PROCESS.STARTED:
        this.handleProcessStarted(message);
        break;

      case MESSAGE_TYPES.WORKER.READY:
        this.handleWorkerReady(message);
        break;

      case MESSAGE_TYPES.PROCESS.FAILED:
        this.handleProcessError(message);
        break;

      case MESSAGE_TYPES.MONITORING.PROGRESS_UPDATE:
        this.handleProgressUpdate(message);
        break;

      case MESSAGE_TYPES.VISUALIZATION.UPDATE:
        this.handleVisualizationUpdate(message);
        break;

      case MESSAGE_TYPES.MONITORING.PERFORMANCE_METRIC:
        this.handlePerformanceMetric(message);
        break;

      case MESSAGE_TYPES.EDGE_DETECTION.COMPLETE:
        this.handleEdgeDetectionComplete(message);
        break;

      case MESSAGE_TYPES.PLATE.SIMULATION_SETUP:
        this.handlePlateSimulationSetup(message);
        break;

      default:
        // Log unhandled message types for debugging
        if (message.type && !message.type.startsWith('unknown')) {
          console.debug('Unhandled message type:', message.type, message);
        }
    }
  }

  private handlePlateletGenerationComplete(message: any): void {
    const processId = `platelet-gen-${message.plateId}`;

    globalStateManager.appState.acts.updateProcess(processId, {
      status: STATUS_TYPES.PROCESS.COMPLETED,
      endTime: Date.now(),
      progress: 1,
    });

    globalStateManager.plates.acts.markComplete(
      message.plateId,
      message.plateletCount,
    );
  }

  private handleProcessStarted(message: any): void {
    globalStateManager.appState.acts.addProcess({
      id: message.processId,
      type: message.processType,
      status: STATUS_TYPES.PROCESS.RUNNING,
      plateId: message.plateId,
      startTime: Date.now(),
      progress: 0,
    });

    if (message.plateId) {
      globalStateManager.plates.acts.updatePlate(message.plateId, {
        status: STATUS_TYPES.PLATE.GENERATING_PLATELETS,
        updatedAt: Date.now(),
      });
    }
  }

  private handleWorkerReady(message: any): void {
    // Update global state to indicate workers are ready
    this.stateManager.dispatchCustomEvent('worker-status-change', {
      status: 'ready',
      timestamp: message.timestamp,
    });
  }

  private handleProcessError(message: any): void {
    // Try to find the related process
    const state = this.stateManager.getState();
    const runningProcesses = Object.values(state.processes).filter(
      (p) => p.status === 'running',
    );

    if (runningProcesses.length > 0) {
      const process = runningProcesses[runningProcesses.length - 1]; // Get most recent
      this.stateManager.updateProcess(process.id, {
        status: 'failed',
        endTime: new Date(),
        error: message.error,
      });
    }
  }

  private handleProgressUpdate(message: any): void {
    if (message.processId) {
      this.stateManager.updateProcess(message.processId, {
        progress: message.progress,
      });
    }
  }

  private handleVisualizationUpdate(message: any): void {
    this.stateManager.updatePlate(message.plateId, {
      status: 'visualized',
      plateletCount: message.plateletCount,
      updatedAt: new Date(),
    });
  }

  private handlePerformanceMetric(message: any): void {
    // Store performance metrics in state
    this.stateManager.dispatchCustomEvent('performance-update', {
      metric: message.metric,
      value: message.value,
      unit: message.unit,
      timestamp: message.timestamp,
    });
  }

  private handleEdgeDetectionComplete(message: any): void {
    this.stateManager.dispatchCustomEvent('edge-detection-complete', {
      flaggedCount: message.flaggedCount,
      timestamp: message.timestamp,
    });
  }

  private handlePlateSimulationSetup(message: any): void {
    // Initialize plates in state
    for (let i = 0; i < message.plateCount; i++) {
      const plateId = `plate-${i.toString().padStart(3, '0')}`;
      this.stateManager.addPlate({
        id: plateId,
        status: 'initializing',
        plateletCount: 0,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  private setupPeriodicUpdates(): void {
    // Update statistics every 5 seconds
    setInterval(() => {
      const state = this.stateManager.getState();

      // Dispatch periodic update event
      this.stateManager.dispatchCustomEvent('periodic-update', {
        statistics: state.statistics,
        timestamp: new Date(),
      });
    }, 5000);
  }

  // Public API methods
  public getStateManager(): StateManager {
    return this.stateManager;
  }

  public getMessageInterceptor(): MessageInterceptor {
    return this.messageInterceptor;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getStatistics() {
    return this.stateManager.getState().statistics;
  }

  public clear(): void {
    this.stateManager.clear();
  }

  public simulateActivity(): void {
    // Simulate some activity for testing
    this.messageInterceptor.simulateMessages();
  }

  public destroy(): void {
    this.messageInterceptor.restore();
    this.stateManager.dispose();
    this.isInitialized = false;
  }

  // Utility method to manually add a process
  public addProcess(type: string, plateId?: string): string {
    const processId = `${type}-${plateId || 'global'}-${Date.now()}`;

    this.stateManager.addProcess({
      id: processId,
      type: type as any,
      status: 'pending',
      plateId,
      startTime: new Date(),
      progress: 0,
    });

    return processId;
  }

  // Utility method to manually add a task
  public addTask(type: string, plateId?: string, priority: number = 1): string {
    const taskId = `${type}-task-${Date.now()}`;

    this.stateManager.addTask({
      id: taskId,
      type,
      priority,
      plateId,
      queuedAt: new Date(),
    });

    return taskId;
  }
}

// Global singleton instance
export const globalProcessMonitor = new ProcessMonitor();

// Export for convenience
export default globalProcessMonitor;
