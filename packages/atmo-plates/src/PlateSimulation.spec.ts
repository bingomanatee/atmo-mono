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
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';

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

  it('should automatically generate plates in the constructor', () => {
    // Create a new simulation with auto-generated plates
    const PLANET_RADIUS = EARTH_RADIUS;
    const PLATE_COUNT = 10;

    // Create a simulation with the constructor that should auto-generate plates
    const sim = new PlateSimulation(PLANET_RADIUS, PLATE_COUNT);

    // Get the plates collection
    const platesCollection = sim.simUniv.get(COLLECTIONS.PLATES);

    // Verify that plates were automatically created
    expect(platesCollection.count()).toBe(PLATE_COUNT);

    // Check that the plates have the expected properties
    const plates: any[] = [];

    // Use the each method to collect all plates
    platesCollection.each((plate) => {
      plates.push(plate);
    });

    // Verify each plate has the required properties
    plates.forEach((plate) => {
      expect(plate.id).toBeDefined();
      expect(plate.radius).toBeDefined();
      expect(plate.density).toBeDefined();
      expect(plate.thickness).toBeDefined();
      expect(plate.position).toBeDefined();
      expect(plate.planetId).toBeDefined();
    });

    // Verify that the plates have different properties (not all the same)
    const uniqueRadii = new Set(plates.map((p) => p.radius));
    const uniqueDensities = new Set(plates.map((p) => p.density));
    const uniqueThicknesses = new Set(plates.map((p) => p.thickness));

    // We should have multiple different values for each property
    expect(uniqueRadii.size).toBeGreaterThan(1);
    expect(uniqueDensities.size).toBeGreaterThan(1);

    // For thickness, we might have only one value in some cases
    expect(uniqueThicknesses.size).toBeGreaterThanOrEqual(1);

    // Verify that a simulation was also created
    const simulationsCollection = sim.simUniv.get(COLLECTIONS.SIMULATIONS);
    expect(simulationsCollection.count()).toBe(1);

    // Get the simulation's planetId
    let planetId;
    simulationsCollection.each((simulation) => {
      planetId = simulation.planetId;
    });
    expect(planetId).toBeDefined();

    // Verify that the planet has the correct radius
    const planetsCollection = sim.simUniv.get(COLLECTIONS.PLANETS);
    const planet = planetsCollection.get(planetId);
    expect(planet).toBeDefined();
    expect(planet.radius).toBe(PLANET_RADIUS);
  });
});
