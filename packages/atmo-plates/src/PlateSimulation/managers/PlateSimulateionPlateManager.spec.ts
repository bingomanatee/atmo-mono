import { beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '../constants';
import { MANAGERS, PlateSimulation } from '../PlateSimulation';
import PlateSimulationPlateManager from './PlateSimulationPlateManager';

describe('PlateSimulationPlateManager', () => {
  let sim: PlateSimulation;
  let manager: PlateSimulationPlateManager;
  let testPlateId: string;

  beforeEach(async () => {
    sim = new PlateSimulation();
    await sim.init(); // Ensure init is called and awaited

    // Create Earth planet
    const earthPlanet = sim.makePlanet(6371000, 'earth'); // Earth radius in meters
    const planetsCollection = sim.simUniv.get(COLLECTIONS.PLANETS);
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

    manager = sim.managers.get(MANAGERS.PLATE) as PlateSimulationPlateManager;
  });

  it('should initialize steps for a plate when initPlateSteps is called', async () => {
    await manager.initPlateSteps(testPlateId);
    const stepsCollection = sim.simUniv.get(COLLECTIONS.PLATELET_STEPS);
    const steps = [];
    for await (const step of stepsCollection.values()) {
      steps.push(step);
    }
    expect(steps.length).toBeGreaterThan(0);
  });

  it('should not throw in constructor even if plate not found initially', () => {
    expect(() => new PlateSimulationPlateManager(sim)).not.toThrow();
  });

  it('should throw in initPlateSteps if plate not found', async () => {
    const nonExistentManager = new PlateSimulationPlateManager(sim);
    await expect(
      nonExistentManager.initPlateSteps('non-existent'),
    ).rejects.toThrow('cannot find plate non-existent');
  });
});
