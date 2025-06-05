import { Forest, ObjectCollection } from '@wonderlandlabs/forestry';
import { PlateSimulation } from '@atmo-plates/PlateSimulation/PlateSimulation';
import { STATUS_TYPES } from '../constants/statusTypes';
import type { SimulationStatus } from '../constants/statusTypes';
import { filter, distinctUntilChanged, map } from 'rxjs/operators';
import type { Subscription } from 'rxjs';

export interface SimulationState {
  status: SimulationStatus;
  phase: 'idle' | 'create' | 'initialize' | 'generate' | 'complete';
  plateCount: number;
  maxPlateRadius: number;
  planetRadius: number;
  useWorkers: boolean;
  useSharedStorage: boolean;
  currentSimulationId?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  generatedPlates: number;
  generatedPlatelets: number;
}

export interface SimulationConfig {
  plateCount: number;
  maxPlateRadius: number;
  planetRadius: number;
  useWorkers: boolean;
  useSharedStorage: boolean;
}

const SIMULATION_ACTIONS = {
  // Actions for simulation control
  startSimulation(
    collection: SimulationController,
    config?: Partial<SimulationConfig>,
  ) {
    // Update configuration if provided
    if (config) {
      collection.update((state) => ({
        ...state,
        ...config,
        status: STATUS_TYPES.SIMULATION.INITIALIZING,
        phase: 'create',
        startTime: Date.now(),
        error: undefined,
      }));
    } else {
      collection.update((state) => ({
        ...state,
        status: STATUS_TYPES.SIMULATION.INITIALIZING,
        phase: 'create',
        startTime: Date.now(),
        error: undefined,
      }));
    }
  },

  createSimulation(collection: SimulationController) {
    try {
      collection.simulation = new PlateSimulation({
        planetRadius: collection.value.planetRadius,
        plateCount: collection.value.plateCount,
        maxPlateRadius: collection.value.maxPlateRadius,
        useWorkers: collection.value.useWorkers,
        useSharedStorage: collection.value.useSharedStorage,
      });

      collection.update((state) => ({
        ...state,
        status: STATUS_TYPES.SIMULATION.RUNNING,
        phase: 'initialize',
      }));
    } catch (error) {
      collection.acts.onSimError(error);
    }
  },

  async initializeSimulation(collection: SimulationController) {
    try {
      await collection.simulation.init();

      collection.update((state) => ({
        ...state,
        generatedPlates: state.plateCount,
        phase: 'generate',
      }));
    } catch (error) {
      collection.acts.onSimError(error);
    }
  },

  async generatePlatelets(collection: SimulationController) {
    try {
      const plateletManager = collection.simulation.managers.get('platelet');
      const platesCollection = collection.simulation.simUniv.get('plates');
      const plateIds: string[] = [];

      platesCollection.each((plate: any) => {
        plateIds.push(plate.id);
      });

      // Generate platelets (don't store results in memory)
      await plateletManager.generatePlateletsForMultiplePlates(plateIds);

      collection.update((state) => ({
        ...state,
        phase: 'complete',
      }));
    } catch (error) {
      collection.acts.onSimError(error);
    }
  },

  completeSimulation(collection: SimulationController) {
    try {
      const plateletsCollection =
        collection.simulation.simUniv.get('platelets');
      const totalPlatelets = plateletsCollection?.count() || 0;

      collection.update((state) => ({
        ...state,
        status: STATUS_TYPES.SIMULATION.COMPLETED,
        phase: 'idle',
        endTime: Date.now(),
        generatedPlatelets: totalPlatelets,
        currentSimulationId: collection.simulation.simulationId,
      }));
    } catch (error) {
      collection.acts.onSimError(error);
    }
  },

  stopSimulation(collection: SimulationController) {
    collection.update((state) => ({
      ...state,
      status: STATUS_TYPES.SIMULATION.CANCELLED,
      phase: 'idle',
      endTime: Date.now(),
    }));
  },

  pauseSimulation(collection: SimulationController) {
    collection.set('status', STATUS_TYPES.SIMULATION.PAUSED);
  },

  resumeSimulation(collection: SimulationController) {
    collection.set('status', STATUS_TYPES.SIMULATION.RUNNING);
  },

  resetSimulation(collection: SimulationController) {
    collection.simulation = null;
    collection.update(() => ({
      status: STATUS_TYPES.SIMULATION.NOT_STARTED,
      phase: 'idle',
      plateCount: 60,
      maxPlateRadius: 500,
      planetRadius: 6371,
      useWorkers: true,
      useSharedStorage: true,
      generatedPlates: 0,
      generatedPlatelets: 0,
      currentSimulationId: undefined,
      error: undefined,
      startTime: undefined,
      endTime: undefined,
    }));
  },

  updateConfig(
    collection: SimulationController,
    config: Partial<SimulationConfig>,
  ) {
    if (collection.value.status === STATUS_TYPES.SIMULATION.RUNNING) {
      throw new Error(
        'Cannot update configuration while simulation is running',
      );
    }
    collection.update((state) => ({ ...state, ...config }));
  },

  // Getters for computed values
  isRunning(collection: SimulationController) {
    return collection.value.status === STATUS_TYPES.SIMULATION.RUNNING;
  },

  isCompleted(collection: SimulationController) {
    return collection.value.status === STATUS_TYPES.SIMULATION.COMPLETED;
  },

  isFailed(collection: SimulationController) {
    return collection.value.status === STATUS_TYPES.SIMULATION.FAILED;
  },

  getExecutionTime(collection: SimulationController) {
    const { startTime, endTime } = collection.value;
    if (startTime && endTime) {
      return endTime - startTime;
    }
    if (startTime) {
      return Date.now() - startTime;
    }
    return 0;
  },

  getProgressPercentage(collection: SimulationController) {
    const { phase } = collection.value;
    switch (phase) {
      case 'idle':
        return 0;
      case 'create':
        return 10;
      case 'initialize':
        return 30;
      case 'generate':
        return 70;
      case 'complete':
        return 100;
      default:
        return 0;
    }
  },

  getSimulation(collection: SimulationController) {
    return collection.simulation;
  },

  onSimError(collection: SimulationController, error: unknown) {
    collection.update((state) => ({
      ...state,
      status: STATUS_TYPES.SIMULATION.FAILED,
      phase: 'idle',
      error: error instanceof Error ? error.message : 'Unknown error',
      endTime: Date.now(),
    }));
  },
};

export class SimulationController extends ObjectCollection<
  string,
  SimulationState
> {
  public simulation: PlateSimulation | null = null;
  private phaseSubscription: Subscription | null = null;

  constructor(forest: Forest) {
    super(
      'simulation',
      {
        // Initial state
        status: STATUS_TYPES.SIMULATION.NOT_STARTED,
        phase: 'idle',
        plateCount: 60,
        maxPlateRadius: 500,
        planetRadius: 6371,
        useWorkers: true,
        useSharedStorage: true,
        generatedPlates: 0,
        generatedPlatelets: 0,
      },
      SIMULATION_ACTIONS,

      forest,
    );

    // Set up phase transition subscription
    this.setupPhaseTransitions();
  }

  private setupPhaseTransitions() {
    this.phaseSubscription = this.subject
      .pipe(
        map((state) => state.phase),
        distinctUntilChanged(),
        filter((phase) => phase !== 'idle'),
      )
      .subscribe((phase) => {
        this.handlePhaseTransition(phase);
      });
  }

  private async handlePhaseTransition(phase: SimulationState['phase']) {
    switch (phase) {
      case 'create':
        this.acts.createSimulation();
        break;
      case 'initialize':
        await this.acts.initializeSimulation();
        break;
      case 'generate':
        await this.acts.generatePlatelets();
        break;
      case 'complete':
        this.acts.completeSimulation();
        break;
      case 'idle':
        // Do nothing - simulation is idle
        break;
    }
  }

  public destroy() {
    if (this.phaseSubscription) {
      this.phaseSubscription.unsubscribe();
      this.phaseSubscription = null;
    }
  }
}
