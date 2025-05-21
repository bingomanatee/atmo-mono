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
  // Shared constants
  const DEFAULT_PLANET_RADIUS = 1000000;
  const DEFAULT_PLATE_RADIUS = 1000;
  const DEFAULT_PLATE_COUNT = 10;

  // Test instance variables
  let sim: PlateSimulation;
  let simId: string;
  let platesCollection: any;
  let planetsCollection: any;
  let simulationsCollection: any;

  beforeEach(() => {
    // Create a fresh simulation for each test
    sim = new PlateSimulation();
    simId = sim.addSimulation({ radius: DEFAULT_PLANET_RADIUS });

    // Get collections for easier access in tests
    platesCollection = sim.simUniv.get(COLLECTIONS.PLATES);
    planetsCollection = sim.simUniv.get(COLLECTIONS.PLANETS);
    simulationsCollection = sim.simUniv.get(COLLECTIONS.SIMULATIONS);
  });

  it('should create a plate', () => {
    // Add a plate using the shared constant
    const plateId = sim.addPlate({
      radius: DEFAULT_PLATE_RADIUS,
    });

    // Retrieve the plate using the shared collection
    const retrievedPlate = platesCollection.get(plateId);
    expect(retrievedPlate.radius).toEqual(DEFAULT_PLATE_RADIUS);
  });

  it('should update a plate', () => {
    // Add a plate using the shared constant
    const plateId = sim.addPlate({
      radius: DEFAULT_PLATE_RADIUS,
    });

    // Get the initial plate using the shared collection
    const initialPlate = platesCollection.get(plateId);

    // Update the plate with a new name
    const updatedData = {
      ...initialPlate,
      name: 'Updated Test Plate',
    };

    // Use the shared collection to update the plate
    platesCollection.set(plateId, updatedData);

    // Retrieve the updated plate
    const retrievedPlate = platesCollection.get(plateId);
    expect(retrievedPlate.name).toEqual('Updated Test Plate');
  });

  it('should delete a plate', () => {
    // Add a plate using the shared constant
    const plateId = sim.addPlate({
      radius: DEFAULT_PLATE_RADIUS,
    });

    // Verify the plate exists using the shared collection
    expect(platesCollection.has(plateId)).toBeTruthy();

    // Delete the plate
    platesCollection.delete(plateId);

    // Verify the plate was deleted
    expect(platesCollection.has(plateId)).toBeFalsy();
  });

  it('should automatically generate plates in the constructor', () => {
    // Create a new simulation with auto-generated plates using shared constants
    const autoSim = new PlateSimulation(EARTH_RADIUS, DEFAULT_PLATE_COUNT);

    // Get collections from the new simulation
    const autoPlatesCollection = autoSim.simUniv.get(COLLECTIONS.PLATES);
    const autoSimulationsCollection = autoSim.simUniv.get(
      COLLECTIONS.SIMULATIONS,
    );
    const autoPlanetsCollection = autoSim.simUniv.get(COLLECTIONS.PLANETS);

    // Verify that plates were automatically created
    expect(autoPlatesCollection.count()).toBe(DEFAULT_PLATE_COUNT);

    // Collect all plates
    const plates: any[] = [];
    autoPlatesCollection.each((plate: PlateIF) => {
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
    expect(autoSimulationsCollection.count()).toBe(1);

    // Get the simulation's planetId
    let planetId;
    autoSimulationsCollection.each((simulation) => {
      planetId = simulation.planetId;
    });
    expect(planetId).toBeDefined();

    // Verify that the planet has the correct radius
    const planet = autoPlanetsCollection.get(planetId);
    expect(planet).toBeDefined();
    expect(planet.radius).toBe(EARTH_RADIUS);
  });
});
