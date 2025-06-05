import './style.css';
import {
  PlateletManager,
  PlateSimulation,
  PlateSpectrumGenerator,
} from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';

import { PlateletVisualizer } from './PlateletVisualizer';
import { ThreeJsSetup } from './ThreeJsSetup';
import { UIStatusManager } from './UIStatusManager';
import { initializeProcessMonitor } from './ProcessMonitor';

const NUM_PLATES = 60;
const threeJsSetup = new ThreeJsSetup();
const { scene } = threeJsSetup.getContext();

// Initialize process monitoring
const processMonitor = initializeProcessMonitor();
console.log('🔍 Process monitor initialized - tracking state and messages');

async function generateAndVisualizePlatelets() {
  const sim = new PlateSimulation({
    planetRadius: EARTH_RADIUS,
    plateCount: NUM_PLATES,
    useSharedStorage: true,
  });

  try {
    await sim.clearDatabases();
    await sim.init();

    if (!sim.simUniv) {
      throw new Error('Simulation universe not initialized properly');
    }
  } catch (error) {
    throw error;
  }

  UIStatusManager.updateStorageType({
    type: 'IDBSun (Shared IndexedDB)',
    status: 'success',
  });

  const largePlates = PlateSpectrumGenerator.generateLargePlates({
    planetRadius: sim.planetRadius,
    count: 20,
    minRadius: Math.PI / 12,
    maxRadius: Math.PI / 6,
  });

  for (const plate of largePlates) {
    await sim.addPlate(plate);
  }

  const platesCollection = sim.simUniv.get('plates');
  const plateletManager = new PlateletManager(sim, false);
  const workerStatus = plateletManager.getWorkerStatus();
  UIStatusManager.updateWorkerStatus(workerStatus);

  const startTime = performance.now();

  const plateIds: string[] = [];
  for await (const [_, plate] of platesCollection.find(
    'simId',
    sim.simulationId,
  )) {
    plateIds.push(plate.id);
  }

  const invalidIds = plateIds.filter((id) => !id);
  if (invalidIds.length > 0) {
    throw new Error(
      `Found ${invalidIds.length} plates with invalid IDs - check plate storage/retrieval`,
    );
  }

  await plateletManager.generatePlateletsForMultiplePlates(plateIds);

  const endTime = performance.now();
  const generationTime = endTime - startTime;

  const plateletsCollection = sim.simUniv.get('platelets');
  const totalPlatelets = await plateletsCollection.count();

  UIStatusManager.updatePerformanceMetrics({
    generationTime,
    plateletCount: totalPlatelets,
  });

  await sim.populatePlateletNeighbors();

  await sim.createIrregularPlateEdges();

  const deletedCount = sim.getDeletedPlateletCount();

  const plateVisualizers: PlateletVisualizer[] = [];

  for await (const [_, plate] of platesCollection.find(
    'simId',
    sim.simulationId,
  )) {
    const visualizer = new PlateletVisualizer(
      scene,
      EARTH_RADIUS,
      plate,
      plateletManager,
    );

    await visualizer.initializeAsync();

    visualizer.visualize();
    plateVisualizers.push(visualizer);
  }

  if (deletedCount > 0) {
    plateVisualizers.forEach((visualizer) => {
      visualizer.refreshColors();
    });
  }

  threeJsSetup.setAnimationCallbacks({
    onUpdate: () => {
      plateVisualizers.forEach((visualizer) => {
        visualizer.update();
      });
    },
  });

  threeJsSetup.startAnimation();
}

generateAndVisualizePlatelets().catch((error) => {
  UIStatusManager.showErrorScreen(error);
});
