import {
  Multiverse,
  Universe,
  asyncIterToMap,
} from '@wonderlandlabs/multiverse';
import { beforeEach, describe, expect, it } from 'vitest';
import { simUniverse } from '../../utils';
import { COLLECTIONS } from '../constants';
import { MANAGER_TYPES } from '../interfaces/ContextProvider';
import { PlateSimulation } from '../PlateSimulation';
import PlateSimulationPlateManager from './PlateSimulationPlateManager';

describe('PlateSimulationPlateManager', () => {
  let sim: PlateSimulation;
  let universe: Universe;
  let manager: PlateSimulationPlateManager;
  let testPlateId: string;

  beforeEach(async () => {
    // Create multiverse and universe with proper collections
    const mv = new Multiverse(new Map());
    universe = await simUniverse(mv);
    sim = new PlateSimulation(universe);
    await sim.init(); // Ensure init is called

    // Create Earth planet
    const earthPlanet = sim.makePlanet(6371000, 'earth'); // Earth radius in meters
    const planetsCollection = universe.get(COLLECTIONS.PLANETS);
    planetsCollection.set(earthPlanet.id, earthPlanet);

    // Create test plate
    testPlateId = await sim.addPlate({
      id: 'test-plate',
      name: 'Test Plate',
      radius: 637100, // 10% of Earth radius
      density: 3300,
      thickness: 100000,
      planetId: earthPlanet.id,
    });

    // Get the actual plate from the simulation
    const plate = await sim.getPlate(testPlateId);
    if (!plate) throw new Error('Test plate not found');

    manager = sim.getManager(
      MANAGER_TYPES.PLATE,
    ) as PlateSimulationPlateManager;
  });

  it('should initialize steps for a plate when initPlateSteps is called', async () => {
    await manager.initPlateSteps(testPlateId, sim); // Pass simulation as ContextProvider
    const stepsCollection = universe.get(COLLECTIONS.PLATELET_STEPS);
    const steps = await asyncIterToMap(stepsCollection.values());
    expect(steps.size).toBeGreaterThan(0);
  });

  it('should not throw in constructor even if plate not found initially', () => {
    expect(() => new PlateSimulationPlateManager(universe)).not.toThrow();
  });

  it('should throw in initPlateSteps if plate not found', async () => {
    const nonExistentManager = new PlateSimulationPlateManager(universe);
    await expect(
      async () => await nonExistentManager.initPlateSteps('non-existent', sim),
    ).rejects.toThrow('Plate non-existent not found');
  });
});
