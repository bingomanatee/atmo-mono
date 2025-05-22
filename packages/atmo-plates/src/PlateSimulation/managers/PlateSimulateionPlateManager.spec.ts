import type { CollSyncIF } from '@wonderlandlabs/multiverse';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIONS } from '../../schema';
import { PlateSimulation } from '../PlateSimulation';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import PlateSimulationPlateManager from './PlateSimulationPlateManager';
import type { CollSync } from '@wonderlandlabs/multiverse';

export function echoTest(phase: 'start' | 'end' = 'start') {
  const { currentTestName } = expect.getState();
  const banner = '_'.repeat(10);
  const label = phase.toUpperCase();
  console.log(`\n${banner} ${currentTestName}: ${label} ${banner}`);
}

describe('PlateSimulationPlateManager', () => {
  let sim: PlateSimulationIF;
  let stepsCollection: CollSync;

  beforeEach(() => {
    sim = new PlateSimulation({});
    sim.init();
    stepsCollection = sim.simUniv.get(COLLECTIONS.STEPS) as CollSync;
    // Assert that the stepsCollection has a find method, even if not explicitly in CollSync type
    expect((stepsCollection as any).find).toBeDefined();
  });

  it('should initialize steps for a plate when initPlateSteps is called', () => {
    // Create a plate
    sim.addPlate({
      id: 'test-plate',
      radius: 100,
      density: 10,
      thickness: 10,
    });

    const plate = sim.getPlate('test-plate') as SimPlateIF;
    expect(plate).toBeDefined();

    // Create the stateless manager
    const manager = new PlateSimulationPlateManager(sim);

    // Initialize steps for the plate using its id
    manager.initPlateSteps(plate.id);

    // Assert that the first step was created for the plate
    const stepsGen = stepsCollection.find('plateId', plate.id);
    const steps = [...stepsGen];
    expect(steps).toHaveLength(1);
    const [step] = [...steps[0].values()];
    expect(step.plateId).toBe(plate.id);
    expect(step.step).toBe(0);
    expect(step.speed).toBeGreaterThan(0);
    expect(step.position).toBeDefined();
    expect(step.velocity).toBeDefined();
  });

  it('should not throw in constructor even if plate not found initially', () => {
    // Creating the manager with only sim should not throw
    expect(() => {
      new PlateSimulationPlateManager(sim);
    }).not.toThrow();
  });

  it('should throw in initPlateSteps if plate not found', () => {
    const manager = new PlateSimulationPlateManager(sim);
    const nonExistentPlateId = 'non-existent-plate';

    expect(() => {
      manager.initPlateSteps(nonExistentPlateId);
    }).toThrow('plate now found');
  });
});
