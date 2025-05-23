import { deGenerateMaps } from '@wonderlandlabs/multiverse';
import { describe, it, expect, beforeEach } from 'vitest';
import { PlateSimulation, MANAGERS } from '../PlateSimulation';
import PlateSimulationPlateManager from './PlateSimulationPlateManager';
import { COLLECTIONS } from '../constants';

describe('PlateSimulationPlateManager', () => {
  let sim: PlateSimulation;
  let manager: PlateSimulationPlateManager;
  let testPlateId: string;

  beforeEach(() => {
    sim = new PlateSimulation();
    sim.init(); // Ensure init is called

    // Create Earth planet
    const earthPlanet = sim.makePlanet(6371000, 'earth'); // Earth radius in meters
    const planetsCollection = sim.simUniv.get(COLLECTIONS.PLANETS);
    planetsCollection.set(earthPlanet.id, earthPlanet);

    // Create test plate
    testPlateId = sim.addPlate({
      id: 'test-plate',
      name: 'Test Plate',
      radius: 637100, // 10% of Earth radius
      density: 3300,
      thickness: 100000,
      planetId: earthPlanet.id,
    });

    // Get the actual plate from the simulation
    const plate = sim.getPlate(testPlateId);
    if (!plate) throw new Error('Test plate not found');

    manager = sim.managers.get(MANAGERS.PLATE) as PlateSimulationPlateManager;
  });

  it('should initialize steps for a plate when initPlateSteps is called', () => {
    manager.initPlateSteps(testPlateId);
    const stepsCollection = sim.simUniv.get(COLLECTIONS.PLATELET_STEPS);
    const steps = deGenerateMaps(stepsCollection.getAll());
    expect(steps.size).toBeGreaterThan(0);
  });

  it('should not throw in constructor even if plate not found initially', () => {
    expect(() => new PlateSimulationPlateManager(sim)).not.toThrow();
  });

  it('should throw in initPlateSteps if plate not found', () => {
    const nonExistentManager = new PlateSimulationPlateManager(sim);
    expect(() => nonExistentManager.initPlateSteps('non-existent')).toThrow(
      'cannot find plate non-existent',
    );
  });
});
