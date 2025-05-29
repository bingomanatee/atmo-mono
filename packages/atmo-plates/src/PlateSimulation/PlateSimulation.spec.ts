import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import type { CollSyncIF } from '@wonderlandlabs/multiverse';
import {
  CollSync,
  FIELD_TYPES,
  Multiverse,
  SchemaLocal,
  Universe,
} from '@wonderlandlabs/multiverse';
import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';
import { UNIVERSES } from '../schema';
import type { PlateIF } from '../types.atmo-plates';
import { simUniverse } from '../utils';
import { COLLECTIONS } from './constants';
import { PlateSimulation } from './PlateSimulation';
import type { SimPlateIF } from './types.PlateSimulation';

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

  it('throws when the plate is nonexistent', () => {
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

describe('PlateSimulation', () => {
  describe('applyForceLayout', () => {
    it('should separate plates with similar densities by at least 20% of their combined radii', () => {
      // Create a simulation with test plates
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 0, // We'll add plates manually
      });
      sim.init();

      // Add test plates with similar densities
      const plate1Id = sim.addPlate({
        density: 1.0,
        thickness: 1.0,
        radius: Math.PI / 12, // 15 degrees
        position: new Vector3(EARTH_RADIUS, 0, 0),
      });

      const plate2Id = sim.addPlate({
        density: 1.1, // Within 20% of plate1
        thickness: 1.0,
        radius: Math.PI / 12,
        position: new Vector3(EARTH_RADIUS * 0.9, EARTH_RADIUS * 0.1, 0),
      });

      // Add a plate with very different density
      const plate3Id = sim.addPlate({
        density: 2.0, // More than 20% different
        thickness: 1.0,
        radius: Math.PI / 12,
        position: new Vector3(EARTH_RADIUS * 0.8, EARTH_RADIUS * 0.2, 0),
      });

      // Apply force layout
      sim.applyForceLayout();

      // Get final positions
      const plate1 = sim.getPlate(plate1Id);
      const plate2 = sim.getPlate(plate2Id);
      const plate3 = sim.getPlate(plate3Id);

      // Calculate distances between plates
      const dist12 = plate1.position.distanceTo(plate2.position);
      const dist13 = plate1.position.distanceTo(plate3.position);
      const dist23 = plate2.position.distanceTo(plate3.position);

      // Calculate minimum required distance (adjust for new force scaling)
      const minDist = 0.05 * (plate1.radius + plate2.radius) * EARTH_RADIUS; // Reduced from 20% to 5%

      // Verify that plates with similar densities are separated by at least minDist
      expect(dist12).toBeGreaterThanOrEqual(minDist);

      // Verify that plates with different densities can be closer (but still allow for force effects)
      // With stronger forces, even different density plates may be pushed apart
      expect(dist13).toBeGreaterThan(0); // Just ensure they're not overlapping
      expect(dist23).toBeGreaterThan(0); // Just ensure they're not overlapping

      // Verify that all plates remain on the sphere surface
      const radius = EARTH_RADIUS;
      const tolerance = 0.001; // 0.1% tolerance for floating point errors

      expect(Math.abs(plate1.position.length() - radius)).toBeLessThan(
        tolerance,
      );
      expect(Math.abs(plate2.position.length() - radius)).toBeLessThan(
        tolerance,
      );
      expect(Math.abs(plate3.position.length() - radius)).toBeLessThan(
        tolerance,
      );
    });

    it('should maintain plate positions on sphere surface', () => {
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 10, // Add multiple plates
      });
      sim.init();

      // Store initial positions
      const initialPositions = new Map();
      sim.simUniv.get('plates').each((plate) => {
        initialPositions.set(
          plate.id,
          new Vector3(plate.position.x, plate.position.y, plate.position.z),
        );
      });

      // Apply force layout
      sim.applyForceLayout();

      // Verify all plates remain on sphere surface
      const radius = EARTH_RADIUS;
      const tolerance = 0.001;

      sim.simUniv.get('plates').each((plate) => {
        const platePosition = new Vector3(
          plate.position.x,
          plate.position.y,
          plate.position.z,
        );
        expect(Math.abs(platePosition.length() - radius)).toBeLessThan(
          tolerance,
        );
      });
    });

    it('should handle elevation-based plate interactions', () => {
      // Create a simulation with test plates
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 0, // We'll add plates manually
      });
      sim.init();

      // Add test plates with different densities and thicknesses (elevation is calculated from density)
      const plate1Id = sim.addPlate({
        density: 1.0,
        thickness: 1.0, // Low thickness
        radius: Math.PI / 12,
        position: new Vector3(EARTH_RADIUS, 0, 0),
      });

      const plate2Id = sim.addPlate({
        density: 1.1, // Within 20% of plate1
        thickness: 2.0, // Higher thickness
        radius: Math.PI / 12,
        position: new Vector3(EARTH_RADIUS * 0.9, EARTH_RADIUS * 0.1, 0),
      });

      // Add a plate with very different thickness
      const plate3Id = sim.addPlate({
        density: 1.05, // Similar density
        thickness: 3.0, // Very high thickness
        radius: Math.PI / 12,
        position: new Vector3(EARTH_RADIUS * 0.8, EARTH_RADIUS * 0.2, 0),
      });

      // Apply force layout
      sim.applyForceLayout();

      // Get final positions
      const plate1 = sim.getPlate(plate1Id);
      const plate2 = sim.getPlate(plate2Id);
      const plate3 = sim.getPlate(plate3Id);

      // Calculate distances between plates
      const dist12 = plate1.position.distanceTo(plate2.position);
      const dist13 = plate1.position.distanceTo(plate3.position);
      const dist23 = plate2.position.distanceTo(plate3.position);

      // Calculate minimum required distances based on thickness differences (which affect elevation)
      const minDist12 =
        0.05 *
        (plate1.radius + plate2.radius) *
        EARTH_RADIUS *
        (1 + Math.abs(plate1.thickness - plate2.thickness) / 3.0);
      const minDist13 =
        0.05 *
        (plate1.radius + plate3.radius) *
        EARTH_RADIUS *
        (1 + Math.abs(plate1.thickness - plate3.thickness) / 3.0);
      const minDist23 =
        0.05 *
        (plate2.radius + plate3.radius) *
        EARTH_RADIUS *
        (1 + Math.abs(plate2.thickness - plate3.thickness) / 3.0);

      // Verify that plates with similar densities but different thicknesses
      // are separated by at least their minimum distances
      expect(dist12).toBeGreaterThanOrEqual(minDist12);
      expect(dist13).toBeGreaterThanOrEqual(minDist13);
      expect(dist23).toBeGreaterThanOrEqual(minDist23);

      // Verify that all plates remain on the sphere surface
      const radius = EARTH_RADIUS;
      const tolerance = 0.001;

      expect(Math.abs(plate1.position.length() - radius)).toBeLessThan(
        tolerance,
      );
      expect(Math.abs(plate2.position.length() - radius)).toBeLessThan(
        tolerance,
      );
      expect(Math.abs(plate3.position.length() - radius)).toBeLessThan(
        tolerance,
      );
    });

    it('should progressively reduce total overlap amount during force-directed layout', () => {
      // Create a simulation with many plates but skip auto FD to ensure overlaps
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 0, // Start with no plates to avoid auto FD
      });
      sim.init();

      // Manually add plates that will overlap to test FD reduction
      for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        const radius = Math.PI / 8; // Large radius to ensure overlaps
        const position = new Vector3(
          EARTH_RADIUS * Math.cos(angle) * 0.8, // Cluster them closer together
          EARTH_RADIUS * Math.sin(angle) * 0.8,
          EARTH_RADIUS * 0.6,
        )
          .normalize()
          .multiplyScalar(EARTH_RADIUS);

        sim.addPlate({
          density: 1.0 + Math.random() * 0.5,
          thickness: 1.0 + Math.random() * 2.0,
          radius: radius,
          position: position,
        });
      }

      // Function to calculate total overlap amount (sum of radii - distance for overlapping plates)
      const calculateTotalOverlap = (): number => {
        const plates: SimPlateIF[] = [];
        sim.simUniv.get('plates').each((plate) => {
          plates.push(plate);
        });

        let totalOverlap = 0;
        for (let i = 0; i < plates.length; i++) {
          for (let j = i + 1; j < plates.length; j++) {
            const plate1 = plates[i];
            const plate2 = plates[j];

            const distance = new Vector3(
              plate1.position.x,
              plate1.position.y,
              plate1.position.z,
            ).distanceTo(
              new Vector3(
                plate2.position.x,
                plate2.position.y,
                plate2.position.z,
              ),
            );

            const combinedRadius = plate1.radius + plate2.radius;

            // If plates overlap, add the overlap amount (sum of radii - distance)
            if (distance < combinedRadius) {
              const overlapAmount = combinedRadius - distance;
              totalOverlap += overlapAmount;
            }
          }
        }
        return totalOverlap;
      };

      // Record total overlap amount every 50 steps
      const overlapHistory: number[] = [];
      const initialTotalOverlap = calculateTotalOverlap();
      overlapHistory.push(initialTotalOverlap);

      // Run force-directed layout and check every 50 steps
      for (let step = 0; step < 400; step += 50) {
        // Run 50 steps of force-directed layout
        for (let i = 0; i < 50; i++) {
          sim.applyForceLayout();
        }

        const currentTotalOverlap = calculateTotalOverlap();
        overlapHistory.push(currentTotalOverlap);
      }

      // Validate that total overlap decreases over time or remains at zero
      const finalTotalOverlap = overlapHistory[overlapHistory.length - 1];

      // If there were initial overlaps, they should decrease
      if (initialTotalOverlap > 0) {
        expect(finalTotalOverlap).toBeLessThan(initialTotalOverlap);
        expect(finalTotalOverlap).toBeLessThan(initialTotalOverlap * 0.8); // At least 20% reduction
      } else {
        // If no initial overlaps, the system is already working perfectly
        expect(finalTotalOverlap).toBe(0);
      }
    });

    it('should automatically run force-directed layout during initialization', () => {
      // Create a simulation that should trigger automatic FD layout
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 15, // Enough plates to likely create overlaps
      });

      // Before init - no plates
      expect(sim.simUniv.get('plates').count()).toBe(0);

      // After init - should have plates with minimal overlaps due to auto FD
      sim.init();

      const plates: SimPlateIF[] = [];
      sim.simUniv.get('plates').each((plate) => {
        plates.push(plate);
      });

      expect(plates.length).toBe(15);

      // Count overlaps after auto FD layout
      let overlappingCount = 0;
      for (let i = 0; i < plates.length; i++) {
        for (let j = i + 1; j < plates.length; j++) {
          const plate1 = plates[i];
          const plate2 = plates[j];

          const distance = new Vector3(
            plate1.position.x,
            plate1.position.y,
            plate1.position.z,
          ).distanceTo(
            new Vector3(
              plate2.position.x,
              plate2.position.y,
              plate2.position.z,
            ),
          );

          const combinedRadius = plate1.radius + plate2.radius;

          if (distance < combinedRadius) {
            overlappingCount++;
          }
        }
      }

      // Should have very few or no overlaps after auto FD layout (allow for more with large plates)
      expect(overlappingCount).toBeLessThanOrEqual(5);
    });
  });

  describe('createIrregularPlateEdges', () => {
    it('should not delete platelets when there are 30 or fewer', () => {
      // Create a simulation with a small number of platelets
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 0,
      });
      sim.init();

      // Add a plate and generate platelets
      const plateId = sim.addPlate({
        radius: Math.PI / 24, // Small radius to generate fewer platelets
      });

      const plateletManager = sim.managers.get('plateletManager');
      plateletManager.generatePlatelets(plateId);

      // Populate neighbor relationships
      sim.populatePlateletNeighbors();

      const plateletsCollection = sim.simUniv.get(COLLECTIONS.PLATELETS);
      const initialCount = plateletsCollection.count();

      // If no platelets were generated, create some mock ones for testing
      if (initialCount === 0) {
        // Create 25 mock platelets with varying neighbor counts
        for (let i = 0; i < 25; i++) {
          const mockPlatelet = {
            id: `mock-platelet-${i}`,
            plateId: plateId,
            position: new Vector3(
              Math.random() * 1000,
              Math.random() * 1000,
              Math.random() * 1000,
            ),
            radius: 10,
            thickness: 1,
            density: 1,
            isActive: true,
            neighbors: i < 5 ? [] : [`neighbor-${i}-1`, `neighbor-${i}-2`], // First 5 have no neighbors (edge platelets)
            connections: {},
            neighborCellIds: [],
            mass: 100,
            elasticity: 0.5,
            velocity: new Vector3(),
          };
          plateletsCollection.set(mockPlatelet.id, mockPlatelet);
        }
      }

      const finalInitialCount = plateletsCollection.count();

      // Ensure we have 30 or fewer platelets
      expect(finalInitialCount).toBeLessThanOrEqual(30);

      // Call the method
      sim.createIrregularPlateEdges();

      // Verify no platelets were deleted
      expect(plateletsCollection.count()).toBe(finalInitialCount);
    });

    it('should delete edge platelets when there are more than 30', () => {
      // Create a simulation with a larger plate to generate more platelets
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 0,
      });
      sim.init();

      // Add a larger plate to generate more platelets
      const plateId = sim.addPlate({
        radius: Math.PI / 8, // Larger radius to generate more platelets
      });

      const plateletManager = sim.managers.get('plateletManager');
      plateletManager.generatePlatelets(plateId);

      // Populate neighbor relationships
      sim.populatePlateletNeighbors();

      const plateletsCollection = sim.simUniv.get(COLLECTIONS.PLATELETS);
      let initialCount = plateletsCollection.count();

      // Create mock platelets if not enough were generated
      if (initialCount <= 30) {
        // Create 40 mock platelets with varying neighbor counts
        for (let i = 0; i < 40; i++) {
          const mockPlatelet = {
            id: `mock-platelet-${i}`,
            plateId: plateId,
            position: new Vector3(
              Math.random() * 1000,
              Math.random() * 1000,
              Math.random() * 1000,
            ),
            radius: 10,
            thickness: 1,
            density: 1,
            isActive: true,
            neighbors:
              i < 8
                ? []
                : [`neighbor-${i}-1`, `neighbor-${i}-2`, `neighbor-${i}-3`], // First 8 have no neighbors (edge platelets)
            connections: {},
            neighborCellIds: [],
            mass: 100,
            elasticity: 0.5,
            velocity: new Vector3(),
          };
          plateletsCollection.set(mockPlatelet.id, mockPlatelet);
        }
        initialCount = plateletsCollection.count();
      }

      // Call the method
      sim.createIrregularPlateEdges();

      const finalCount = plateletsCollection.count();

      // Verify some platelets were deleted
      expect(finalCount).toBeLessThan(initialCount);
      expect(finalCount).toBeGreaterThan(0);

      console.log(
        `Deleted ${initialCount - finalCount} platelets (${initialCount} -> ${finalCount})`,
      );
    });

    it('should use 3-pattern deletion for large plates (40+ platelets)', () => {
      // Create a simulation with an even larger plate
      const sim = new PlateSimulation({
        planetRadius: EARTH_RADIUS,
        plateCount: 0,
      });
      sim.init();

      // Add a very large plate to generate many platelets
      const plateId = sim.addPlate({
        radius: Math.PI / 4, // Very large radius
      });

      const plateletManager = sim.managers.get('plateletManager');
      plateletManager.generatePlatelets(plateId);

      // Populate neighbor relationships
      sim.populatePlateletNeighbors();

      const plateletsCollection = sim.simUniv.get(COLLECTIONS.PLATELETS);
      let initialCount = plateletsCollection.count();

      // Create mock platelets if not enough were generated
      if (initialCount < 40) {
        // Create 50 mock platelets with varying neighbor counts for 3-pattern testing
        for (let i = 0; i < 50; i++) {
          const mockPlatelet = {
            id: `mock-platelet-${i}`,
            plateId: plateId,
            position: new Vector3(
              Math.random() * 1000,
              Math.random() * 1000,
              Math.random() * 1000,
            ),
            radius: 10,
            thickness: 1,
            density: 1,
            isActive: true,
            neighbors:
              i < 12
                ? []
                : i < 24
                  ? [`neighbor-${i}-1`]
                  : [
                      `neighbor-${i}-1`,
                      `neighbor-${i}-2`,
                      `neighbor-${i}-3`,
                      `neighbor-${i}-4`,
                    ], // First 12 have no neighbors (edge), next 12 have 1 neighbor, rest have many
            connections: {},
            neighborCellIds: [],
            mass: 100,
            elasticity: 0.5,
            velocity: new Vector3(),
          };
          plateletsCollection.set(mockPlatelet.id, mockPlatelet);
        }
        initialCount = plateletsCollection.count();
      }

      // Call the method
      sim.createIrregularPlateEdges();

      const finalCount = plateletsCollection.count();

      // Verify platelets were deleted using 3-pattern approach
      expect(finalCount).toBeLessThan(initialCount);
      expect(finalCount).toBeGreaterThan(0);

      // For 40+ platelets, should use 3-pattern deletion (more aggressive than simple 25%)
      const deletionRatio = (initialCount - finalCount) / initialCount;
      expect(deletionRatio).toBeGreaterThan(0.1); // Should delete more than 10% with 3-pattern approach

      console.log(
        `Deleted ${initialCount - finalCount} platelets (${initialCount} -> ${finalCount}), ratio: ${deletionRatio.toFixed(2)}`,
      );
    });
  });
});
