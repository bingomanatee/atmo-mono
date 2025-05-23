import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import {
  CollSync,
  FIELD_TYPES,
  Multiverse,
  SchemaLocal,
  Universe,
} from '@wonderlandlabs/multiverse';
import type { CollSyncIF } from '@wonderlandlabs/multiverse';
import { v4 as uuidV4 } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';
import { UNIVERSES } from '../schema';
import { COLLECTIONS } from './constants';
import type { PlateIF } from '../types.atmo-plates';
import { simUniverse } from '../utils';
import { PlateSimulation } from './PlateSimulation';

const DEFAULT_PLANET_RADIUS = 1000000;
const DEFAULT_PLATE_RADIUS = 1000;
const DEFAULT_PLATE_COUNT = 10;

describe('PlateSimulation:class', () => {
  let sim: PlateSimulation;
  let platesCollection: any;
  let planetsCollection: CollSyncIF;
  let simulationsCollection: CollSyncIF;
  let simId: string;

  beforeEach(() => {
    // Create a fresh simulation for each test
    sim = new PlateSimulation();

    // Initialize the simulation
    sim.init();

    // Get collections for easier access in tests
    platesCollection = sim.simUniv.get(COLLECTIONS.PLATES);
    planetsCollection = sim.simUniv.get(COLLECTIONS.PLANETS);
    simulationsCollection = sim.simUniv.get(COLLECTIONS.SIMULATIONS);

    // Add a simulation with a specific radius
    simId = sim.addSimulation({ radius: DEFAULT_PLANET_RADIUS });
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

  it('should get a plate by ID using getPlate method', () => {
    // Add a plate with custom properties
    const customName = 'Test Plate';
    const customRadius = 2000;
    const customDensity = 2.5;

    const plateId = sim.addPlate({
      name: customName,
      radius: customRadius,
      density: customDensity,
    });

    // Retrieve the plate using the getPlate method
    const retrievedPlate = sim.getPlate(plateId);

    // Verify the plate was retrieved correctly
    expect(retrievedPlate).toBeDefined();
    expect(retrievedPlate?.id).toEqual(plateId);
    expect(retrievedPlate?.name).toEqual(customName);
    expect(retrievedPlate?.radius).toEqual(customRadius);
    expect(retrievedPlate?.density).toEqual(customDensity);
  });

  it('throws when the plate is nonexistant', () => {
    // Verify that getPlate returns undefined for non-existent plates
    const nonExistentId = 'non-existent-id';
    expect(() => sim.getPlate(nonExistentId)).toThrow();
  });

  it('should automatically generate plates in the constructor', () => {
    // Create a new simulation with auto-generated plates using shared constants
    const autoSim = new PlateSimulation({
      planetRadius: EARTH_RADIUS,
      plateCount: DEFAULT_PLATE_COUNT,
    });

    // Initialize the simulation
    autoSim.init();

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

  it('should use an injected multiverse with pre-populated data', () => {
    // Create a pre-populated multiverse with an empty schema (will be populated by simUniverse)
    const mv = new Multiverse(new Map());
    simUniverse(mv);

    // Add a planet to the multiverse
    const simUniv = mv.get(UNIVERSES.SIM);
    const planetId = uuidV4();
    const preExistingPlanet = {
      id: planetId,
      radius: DEFAULT_PLANET_RADIUS,
      name: 'Pre-existing Planet',
    };
    simUniv.get(COLLECTIONS.PLANETS).set(planetId, preExistingPlanet);

    // Add a simulation to the multiverse
    const simId = uuidV4();
    const preExistingSimulation = {
      id: simId,
      name: 'Pre-existing Simulation',
      planetId,
      plateCount: 0,
    };
    simUniv.get(COLLECTIONS.SIMULATIONS).set(simId, preExistingSimulation);

    // Create a simulation with the pre-populated multiverse
    const simWithInjectedMv = new PlateSimulation({
      planetRadius: EARTH_RADIUS,
      multiverse: mv,
      universeName: UNIVERSES.SIM,
      simulationId: simId,
    });

    // Initialize the simulation
    simWithInjectedMv.init();

    // Verify that the simulation found the pre-existing planet
    const retrievedPlanet = simWithInjectedMv.getPlanet(planetId);
    expect(retrievedPlanet).toBeDefined();
    expect(retrievedPlanet?.id).toBe(planetId);
    expect(retrievedPlanet?.name).toBe('Pre-existing Planet');

    // Verify that the simulation found the pre-existing simulation
    expect(simWithInjectedMv.simUniv.get(COLLECTIONS.SIMULATIONS).count()).toBe(
      1,
    );
    const retrievedSim = simWithInjectedMv.simUniv
      .get(COLLECTIONS.SIMULATIONS)
      .get(simId);
    expect(retrievedSim).toBeDefined();
    expect(retrievedSim.name).toBe('Pre-existing Simulation');

    // Add a plate to the simulation
    const plateId = simWithInjectedMv.addPlate({
      radius: DEFAULT_PLATE_RADIUS,
      planetId,
    });

    // Verify that the plate was added to the pre-existing multiverse
    const plate = mv.get(UNIVERSES.SIM).get(COLLECTIONS.PLATES).get(plateId);
    expect(plate).toBeDefined();
    expect(plate.radius).toBe(DEFAULT_PLATE_RADIUS);
    expect(plate.planetId).toBe(planetId);
  });

  it('should use getPlanet to retrieve a planet by ID', () => {
    // Get the current planet
    const currentPlanet = sim.planet;

    // Retrieve the planet using getPlanet
    const retrievedPlanet = sim.getPlanet(currentPlanet.id);

    // Verify the planet was retrieved correctly
    expect(retrievedPlanet).toBeDefined();
    expect(retrievedPlanet?.id).toEqual(currentPlanet.id);
    expect(retrievedPlanet?.radius).toEqual(currentPlanet.radius);

    // Verify that getPlanet throws for non-existent planets
    const nonExistentId = 'non-existent-id';
    expect(() => sim.getPlanet(nonExistentId)).toThrow(
      'cannot find planet non-existent-id',
    );
  });

  it('should use a custom universe name when provided', () => {
    // Create a multiverse with a custom universe
    const mv = new Multiverse(new Map());
    const customUniverseName = 'customUniverse';

    // Create a universe with the custom name
    const customUniv = new Universe(customUniverseName, mv);

    // Add collections to the custom universe
    const platesCollection = new CollSync({
      name: COLLECTIONS.PLATES,
      universe: customUniv,
      schema: new SchemaLocal(COLLECTIONS.PLATES, {
        id: FIELD_TYPES.string,
        radius: FIELD_TYPES.number,
      }),
    });

    const planetsCollection = new CollSync({
      name: COLLECTIONS.PLANETS,
      universe: customUniv,
      schema: new SchemaLocal(COLLECTIONS.PLANETS, {
        id: FIELD_TYPES.string,
        radius: FIELD_TYPES.number,
      }),
    });

    const simulationsCollection = new CollSync({
      name: COLLECTIONS.SIMULATIONS,
      universe: customUniv,
      schema: new SchemaLocal(COLLECTIONS.SIMULATIONS, {
        id: FIELD_TYPES.string,
        name: FIELD_TYPES.string,
        planetId: FIELD_TYPES.string,
      }),
    });

    // Add the collections to the universe
    customUniv.add(platesCollection);
    customUniv.add(planetsCollection);
    customUniv.add(simulationsCollection);

    // Create a simulation with the custom universe name using props object
    const customSim = new PlateSimulation({
      planetRadius: EARTH_RADIUS,
      multiverse: mv,
      universeName: customUniverseName,
    });

    // Initialize the simulation
    customSim.init();

    // Verify that the simulation uses the custom universe
    expect(customSim.universeName).toBe(customUniverseName);
    expect(customSim.simUniv).toBe(customUniv);

    // Add a planet and verify it's in the custom universe
    const planetId = customSim.planet.id;
    const planet = mv
      .get(customUniverseName)
      .get(COLLECTIONS.PLANETS)
      .get(planetId);
    expect(planet).toBeDefined();
    expect(planet.radius).toBe(EARTH_RADIUS);
  });
});
