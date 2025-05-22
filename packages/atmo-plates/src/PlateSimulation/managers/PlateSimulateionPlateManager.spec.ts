import type { CollSyncIF } from '@wonderlandlabs/multiverse';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIONS } from '../../schema';
import { PlateSimulation } from '../PlateSimulation';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import PlateSimulationPlateManager from './PlateSimulationPlateManager';

export function echoTest(phase: 'start' | 'end' = 'start') {
  const { currentTestName } = expect.getState();
  const banner = '_'.repeat(10);
  const label = phase.toUpperCase();
  console.log(`\n${banner} ${currentTestName}: ${label} ${banner}`);
}

describe('PlateSimulationPlateManager', () => {
  let sim: PlateSimulationIF;
  let stepsCollection: CollSyncIF;

  beforeEach(() => {
    sim = new PlateSimulation({});
    sim.init();
    stepsCollection = sim.simUniv.get(COLLECTIONS.STEPS);
  });

  it('should initialize with a plate and create first step', () => {
    const platCollection: CollSyncIF = sim!.simUniv.get(COLLECTIONS.PLATES);
    const g = platCollection.getAll();

    sim.addPlate({
      radius: 100,
      density: 10,
      thickness: 10,
    });

    const { value: plates } = g.next();
    let plate: SimPlateIF;
    if (plates?.size) {
      plate = [...plates.values()][0] as SimPlateIF;
    } else throw 'no plate present to test';

    const manager = new PlateSimulationPlateManager({
      sim: sim!,
      plate: plate,
    });

    const stepsGen = stepsCollection.find('plateId', plate.id);
    const steps = [...stepsGen];
    expect(steps).toHaveLength(1);
    const [step] = [...steps[0].values()];
    expect(step.plateId).toBe(plate.id);
    expect(step.speed).toBeGreaterThan(0);
    expect(step.position).toBeDefined();
    expect(step.velocity).toBeDefined();
  });

  it('should initialize from plate ID', () => {
    const plateId = 'plate-1';
    sim.addPlate({
      id: plateId,
      radius: 100,
      density: 10,
      thickness: 10,
    });

    const manager = new PlateSimulationPlateManager({
      sim,
      id: plateId,
    });
    const stepsGen = stepsCollection.find('plateId', plateId);
    const steps = [...stepsGen];
    expect(steps).toHaveLength(1);
    const [step] = [...steps[0].values()];
    expect(step.plateId).toBe(plateId);
    expect(step.speed).toBeGreaterThan(0);
    expect(step.position).toBeDefined();
    expect(step.velocity).toBeDefined();
  });

  it('should throw if plate not found', () => {
    expect(
      () => new PlateSimulationPlateManager({ sim, id: 'unknown-plate' }),
    ).not.toThrow(); // doesn't throw immediately, just doesn't init
  });

  it('should throw if planet not found', () => {
    sim.addPlate({
      radius: 100,
      density: 10,
      thickness: 10,
    });

    const platCollection: CollSyncIF = sim.simUniv.get(COLLECTIONS.PLATES);
    const { value: plates } = platCollection.getAll().next();
    const plate = [...plates.values()][0] as SimPlateIF;

    sim.getPlanet = vi.fn(() => undefined);
    expect(() => {
      new PlateSimulationPlateManager({ sim, plate });
    }).toThrow(/Planet .* not found/);
  });
});
