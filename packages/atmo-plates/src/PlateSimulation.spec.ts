import {
  CollAsync,
  CollSync,
  FIELD_TYPES,
  Multiverse,
  SchemaLocal,
  SchemaUniversal,
  Universe,
} from '@wonderlandlabs/multiverse';
import { v4 as uuidV4 } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from './constants';
import { PlateSimulation } from './PlateSimulation';

describe('PlateSimulation:class', () => {
  let sim: PlateSimulation;
  let simId: string;
  beforeEach(() => {
    sim = new PlateSimulation();
    simId = sim.addSimulation({ radius: 1000000 });
  });

  it('should create a plate', () => {
    const PLATE_RADIUS = 1000;
    const plateId = sim.addPlate({
      radius: PLATE_RADIUS,
    });
    const retrievedPlate = sim.simUniv.get(COLLECTIONS.PLATES).get(plateId);
    expect(retrievedPlate.radius).toEqual(PLATE_RADIUS);
  });

  it('should update a plate', () => {
    const PLATE_RADIUS = 1000;
    const plateId = sim.addPlate({
      radius: PLATE_RADIUS,
    });

    // Get the initial plate
    const initialPlate = sim.simUniv.get(COLLECTIONS.PLATES).get(plateId);

    // Update the plate with a new name
    const updatedData = {
      ...initialPlate,
      name: 'Updated Test Plate',
    };

    sim.simUniv.get(COLLECTIONS.PLATES).set(plateId, updatedData);

    // Retrieve the updated plate
    const retrievedPlate = sim.simUniv.get(COLLECTIONS.PLATES).get(plateId);
    expect(retrievedPlate.name).toEqual('Updated Test Plate');
  });

  it('should delete a plate', () => {
    const PLATE_RADIUS = 1000;
    const plateId = sim.addPlate({
      radius: PLATE_RADIUS,
    });

    // Verify the plate exists
    const platesCollection = sim.simUniv.get(COLLECTIONS.PLATES);
    // Delete the plate
    platesCollection.delete(plateId);

    // Verify the plate was deleted
    expect(platesCollection.has(plateId)).toBeFalsy();
  });
});
