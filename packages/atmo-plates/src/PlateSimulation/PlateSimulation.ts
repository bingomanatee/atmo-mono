import {
  EARTH_RADIUS,
  randomNormal,
  latLonToPoint,
  getH3CellForPosition,
} from '@wonderlandlabs/atmo-utils';
import { Multiverse } from '@wonderlandlabs/multiverse';
import type { Vector3Like } from 'three';
import { v4 as uuidV4 } from 'uuid';
import { PlateSpectrumGenerator } from '../generator/PlateSpectrumGenerator';
import { UNIVERSAL_SCHEMA, UNIVERSES } from '../schema';
import { isPlateExtendedIF } from '../typeGuards';
import type {
  PlateExtendedIF,
  PlateIF,
  SimPlanetIF,
  Identifiable,
} from './types.PlateSimulation';
import { simUniverse } from '../utils';
import { extendPlate } from '../utils/plateUtils';
import { COLLECTIONS } from './constants';
import { PlateletManager } from './managers/PlateletManager';
import PlateSimulationPlateManager from './managers/PlateSimulationPlateManager';
import type {
  AddPlateProps,
  PlateSimulationIF,
  PlateSimulationProps,
  SimPlateIF,
  SimProps,
} from './types.PlateSimulation';
import { gridDisk } from 'h3-js';
import { Vector3 } from 'three';
import { Planet } from './Planet';

// Define manager keys
export const MANAGERS = {
  PLATE: 'plateManager',
  PLATELET: 'plateletManager',
};

// @deprecated Use SimPlateIF instead
export interface Plate extends PlateIF {
  position: Vector3Like; // 3D position
}

export class PlateSimulation implements PlateSimulationIF {
  readonly multiverse: Multiverse;
  readonly universeName: string;
  public planetRadius: number;
  public simulationId?: string;
  #defaultSimId: string | undefined;
  readonly managers: Map<string, any>; // Map to store manager instances
  #l0NeighborCache: Map<string, string[]> = new Map(); // Cache for L0 cell neighbors
  #step: number = 0;
  #maxPlateRadius: number | undefined;

  /**
   * Create a new plate simulation
   * @param props - Configuration properties for the simulation
   */
  #initPlateCount: number;

  constructor(props: PlateSimulationProps = {}) {
    // Extract properties with defaults
    const {
      planetRadius = EARTH_RADIUS,
      multiverse: multiverseFromProps,
      universeName = UNIVERSES.SIM,
      simulationId,
      plateCount = 0,
      maxPlateRadius, // Extract maxPlateRadius
    } = props;

    // Initialize basic properties
    this.planetRadius = planetRadius;
    this.multiverse = multiverseFromProps || new Multiverse(UNIVERSAL_SCHEMA);
    this.universeName = universeName;
    this.simulationId = simulationId;
    this.#initPlateCount = plateCount;

    // If simulationId is provided, set it as the default
    if (simulationId) {
      this.#defaultSimId = simulationId;
    }

    // Initialize the simulation universe if it doesn't exist
    if (!this.multiverse.has(this.universeName)) {
      simUniverse(this.multiverse);
    }

    // Initialize managers
    this.managers = new Map<string, any>();
    this.managers.set(MANAGERS.PLATE, new PlateSimulationPlateManager(this));
    this.managers.set(MANAGERS.PLATELET, new PlateletManager(this));

    // Store maxPlateRadius
    this.#maxPlateRadius = maxPlateRadius;
  }

  /**
   * Initialize the simulation
   * This is separate from the constructor to allow for future async initialization
   */
  init(): void {
    const plateManager = new PlateSimulationPlateManager(this);
    this.managers.set(MANAGERS.PLATE, plateManager);

    const plateletManager = new PlateletManager(this);
    this.managers.set(MANAGERS.PLATELET, plateletManager);

    // The basic properties are already initialized in the constructor

    // If simulationId is provided, load that specific simulation
    if (this.simulationId) {
      // Set the default simulation ID if not already set
      if (!this.#defaultSimId) {
        this.#defaultSimId = this.simulationId;
      }

      this.loadExistingSimulation(this.simulationId);
    } else {
      // Pass maxPlateRadius to setupNewSimulation
      this.setupNewSimulation(this.#initPlateCount, this.#maxPlateRadius);
    }
  }

  /**
   * Load an existing simulation by ID
   */
  private loadExistingSimulation(simulationId: string): void {
    // Get the simulation
    const simulationsCollection = this.simUniv.get(COLLECTIONS.SIMULATIONS);
    const simulation = simulationsCollection.get(simulationId);

    if (!simulation) {
      throw new Error(`Simulation ${simulationId} not found`);
    }

    // Set as default simulation
    this.#defaultSimId = simulationId;

    // Get the planet from the simulation
    const planetId = simulation.planetId;
    const planetsCollection = this.simUniv.get(COLLECTIONS.PLANETS);
    const planet = planetsCollection.get(planetId);

    if (!planet) {
      throw new Error(
        `Planet ${planetId} not found in simulation ${simulationId}`,
      );
    }

    // Set the planet
    this.planet = planet;

    // Get the plateCount and maxPlateRadius from the simulation record
    const plateCount = simulation.plateCount;
    const maxPlateRadius = simulation.maxPlateRadius; // Extract maxPlateRadius

    // Check if we need to generate plates
    if (plateCount) {
      // Count existing plates for this planet
      const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);

      // Check if there are any plates for this planet
      let hasPlatesForPlanet = false;
      for (const [_, value] of platesCollection.values()) {
        if (value.planetId === planetId) {
          hasPlatesForPlanet = true;
          break;
        }
      }

      // Only generate plates if there are none for this planet
      if (!hasPlatesForPlanet) {
        // Pass maxPlateRadius to plateGenerator
        const { plates } = this.plateGenerator(
          plateCount,
          maxPlateRadius,
        ).generate();

        for (const plate of plates) {
          this.addPlate(
            {
              ...plate,
              planetId,
            },
            simulationId,
          );
        }
      }
    }
  }

  /**
   * Set up a new simulation if none is specified
   * @param plateCount - Number of plates to generate
   * @param maxPlateRadius - Optional maximum plate radius in radians
   */
  private setupNewSimulation(
    plateCount: number = 0,
    maxPlateRadius?: number,
  ): void {
    // Check if a simulation exists, if not create one
    const simulationsCollection = this.simUniv.get(COLLECTIONS.SIMULATIONS);

    // Check if we already have a default simulation ID
    if (this.#defaultSimId && simulationsCollection.has(this.#defaultSimId)) {
      // Get the simulation
      const simulation = simulationsCollection.get(this.#defaultSimId);
      if (!simulation) {
        throw new Error(`Simulation ${this.#defaultSimId} not found`);
      }

      let plateCount = simulation.plateCount;
      let maxPlateRadius = simulation.maxPlateRadius; // Extract maxPlateRadius

      // Get the planet directly from the simulation's planetId
      if (simulation.planetId) {
        const planet = this.simUniv
          .get(COLLECTIONS.PLANETS)
          .get(simulation.planetId);

        if (planet) {
          this.planet = planet;
        } else {
          // If the planet doesn't exist but the simulation references it, create a new one
          console.warn(
            `Planet ${simulation.planetId} referenced in simulation ${this.#defaultSimId} not found. Creating a new planet.`,
          );
          this.planet = this.makePlanet(this.planetRadius);

          // Update the simulation with the new planet ID and maxPlateRadius
          simulationsCollection.set(this.#defaultSimId, {
            ...simulation,
            planetId: this.planet.id,
            maxPlateRadius: maxPlateRadius, // Include maxPlateRadius
          });
        }
      } else {
        // If the simulation doesn't have a planetId, create a planet and update the simulation
        this.planet = this.makePlanet(this.planetRadius);

        simulationsCollection.set(this.#defaultSimId, {
          ...simulation,
          planetId: this.planet.id,
          maxPlateRadius: maxPlateRadius, // Include maxPlateRadius
        });
      }
    } else {
      // If no simulation exists, create a new planet
      this.planet = this.makePlanet(this.planetRadius);

      // Create a new simulation with the plateCount and maxPlateRadius
      this.addSimulation({
        planetId: this.planet.id,
        plateCount: plateCount,
        maxPlateRadius: maxPlateRadius, // Include maxPlateRadius
      });
    }

    // Check if there are already plates in the universe
    const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);
    const existingPlatesCount = platesCollection.count();

    // Generate plates if the simulation has a plateCount and there are none already
    if (plateCount > 0 && existingPlatesCount === 0) {
      // Pass maxPlateRadius to plateGenerator
      const { plates } = this.plateGenerator(
        plateCount,
        maxPlateRadius,
      ).generate();

      for (const plate of plates) {
        this.addPlate(plate);
      }
    }
  }

  plateGenerator(plateCount: number, maxPlateRadius?: number) {
    return new PlateSpectrumGenerator({
      planetRadius: this.planetRadius,
      plateCount: plateCount,
      maxPlateRadius: maxPlateRadius, // Pass maxPlateRadius to the generator
    });
  }

  get simUniv() {
    return this.multiverse.get(this.universeName)!;
  }

  addSimulation(props: SimProps): string {
    let { name, id, radius, planetId, plateCount = 0, maxPlateRadius } = props; // Extract maxPlateRadius

    if (!id) id = uuidV4();
    if (!name) name = `sim-${id}`;

    // If planetId is provided, verify it exists
    if (planetId) {
      const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
      if (!planet) {
        throw new Error(`Planet ${planetId} not found`);
      }
    }
    // If radius is provided, create a new planet
    else if (radius) {
      const newPlanet = this.makePlanet(radius);
      planetId = newPlanet.id;
    }
    // If neither planetId nor radius is provided, use the existing planet
    else {
      planetId = this.planet.id;
    }

    // Create the simulation
    this.simUniv.get(COLLECTIONS.SIMULATIONS).set(id, {
      id,
      name,
      planetId,
      plateCount,
      maxPlateRadius, // Include maxPlateRadius in simulation record
    });

    // Set as default if no default exists
    if (!this.#defaultSimId) {
      this.#defaultSimId = id;
    }

    return id;
  }

  /**
   * Get the current simulation
   * @returns The simulation object
   */
  get step(): number {
    return this.#step;
  }

  get simulation(): SimSimulation {
    if (!this.#defaultSimId) {
      throw new Error('No default simulation ID set');
    }

    const simulation = this.simUniv
      .get(COLLECTIONS.SIMULATIONS)
      .get(this.#defaultSimId);

    if (!simulation) {
      throw new Error(`Simulation ${this.#defaultSimId} not found`);
    }

    return simulation;
  }

  /**
   * Get a simulation by ID
   * @param simId - The simulation ID
   * @returns The simulation object
   */
  getSimulationById(simId: string): SimSimulation {
    const simulation = this.simUniv.get(COLLECTIONS.SIMULATIONS).get(simId);

    if (!simulation) {
      throw new Error(`Simulation ${simId} not found`);
    }

    return simulation;
  }

  /**
   * Add a plate to the simulation
   * @param props - Properties of the plate to add
   * @param simId - Optional simulation ID (uses default if not provided)
   * @returns The ID of the added plate
   */
  addPlate(props: AddPlateProps, simId?: string): string {
    // Extract properties with defaults
    let { id, name, radius, density = 1, thickness = 1, planetId } = props;

    // Generate ID if not provided
    if (!id) id = uuidV4();

    // Generate name if not provided
    if (!name) name = `plate-${id}`;

    // If planetId is provided, verify it exists
    if (planetId) {
      const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
      if (!planet) {
        throw new Error(`Planet ${planetId} not found`);
      }
    }
    // If planetId is not provided, get it from the simulation or use the default planet
    else {
      // If simId is provided, get the planetId from that simulation
      if (simId) {
        try {
          const sim = this.getSimulationById(simId);
          planetId = sim.planetId;
        } catch (error) {
          throw new Error(`Simulation ${simId} not found: ${error.message}`);
        }
      }
      // If no simId is provided, try to use the default simulation
      else if (this.#defaultSimId) {
        try {
          planetId = this.simulation.planetId;
        } catch (error) {
          // If there's an error getting the simulation, continue without a planetId
          console.warn('Error getting default simulation:', error);
        }
      }

      // If we still don't have a planetId, use the current planet
      if (!planetId) {
        planetId = this.planet.id;
      }
    }

    // Verify the planet exists (final check)
    const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
    if (!planet) {
      throw new Error(`Planet ${planetId} not found`);
    }

    // Create position vector on the planet surface
    const position = randomNormal().setLength(planet.radius);

    // Create the plate object with SimPlateIF interface
    let plateData: SimPlateIF;

    if (isPlateExtendedIF(props)) {
      // If it's already an extended plate, just add the simulation-specific properties
      plateData = {
        ...(props as PlateExtendedIF),
        id,
        name,
        planetId,
        position,
      };
    } else {
      // If it's a basic plate, extend it with derived properties
      const basicPlate: PlateIF & { id: string } = {
        id,
        radius,
        density,
        thickness,
      };

      // Extend the plate with derived properties
      const extendedPlate = extendPlate(basicPlate, planet.radius);

      // Add simulation-specific properties
      plateData = {
        id, // Explicitly add id to ensure TypeScript recognizes it
        ...extendedPlate,
        name,
        planetId,
        position,
      };
    }

    // Add the plate to the collection
    this.simUniv.get(COLLECTIONS.PLATES).set(id, plateData);
    return id;
  }

  getPlate(id: string): SimPlateIF {
    const plate = this.simUniv.get(COLLECTIONS.PLATES).get(id);
    if (!plate) throw new Error('cannot find plate ' + id);
    return plate;
  }

  getPlanet(id: string): Planet {
    const planetData = this.simUniv.get(COLLECTIONS.PLANETS).get(id);
    if (!planetData) throw new Error('cannot find planet ' + id);
    return Planet.fromJSON(planetData);
  }

  planet: SimPlanetIF | undefined;

  makePlanet(radius = this.planetRadius, name?: string): SimPlanetIF {
    if (radius < 1000) {
      throw new Error('planet radii must be >= 1000km');
    }
    const planet = new Planet({ radius, name });

    // Set the planet data in the collection
    this.simUniv.get(COLLECTIONS.PLANETS).set(planet.id, planet.toJSON());

    return planet;
  }

  /**
   * Apply a force-directed layout to the plates based on density similarity.
   * This method modifies the positions of the plates within the simulation.
   * @returns A map of plate ID to the calculated force vector for that plate.
   */
  public applyForceLayout(): Map<string, THREE.Vector3> {
    const plates = Array.from(this.simUniv.get(COLLECTIONS.PLATES).values());
    const planetRadius = this.planetRadius;
    const forces = new Map<string, THREE.Vector3>();
    plates.forEach((plate) => {
      forces.set(plate.id, new THREE.Vector3());
    });

    // Calculate forces between all pairs of plates
    for (let i = 0; i < plates.length; i++) {
      for (let j = i + 1; j < plates.length; j++) {
        const plate1 = plates[i];
        const plate2 = plates[j];

        // Calculate distance between plates
        const distance = plate1.position.distanceTo(plate2.position);
        const sumOfRadii = (plate1.radius + plate2.radius) * planetRadius;

        // Calculate vertical ranges for each plate (elevation ± thickness/2)
        const plate1MinElevation =
          plate1.elevation - (plate1.thickness * 1000) / 2; // Convert thickness from km to m
        const plate1MaxElevation =
          plate1.elevation + (plate1.thickness * 1000) / 2;
        const plate2MinElevation =
          plate2.elevation - (plate2.thickness * 1000) / 2; // Convert thickness from km to m
        const plate2MaxElevation =
          plate2.elevation + (plate2.thickness * 1000) / 2;

        // Add 20% safety margin to each range
        const safetyMargin = 0.2;
        const plate1MinElevationSafe = plate1MinElevation * (1 - safetyMargin);
        const plate1MaxElevationSafe = plate1MaxElevation * (1 + safetyMargin);
        const plate2MinElevationSafe = plate2MinElevation * (1 - safetyMargin);
        const plate2MaxElevationSafe = plate2MaxElevation * (1 + safetyMargin);

        // Check for vertical overlap
        const hasVerticalOverlap =
          (plate1MinElevationSafe <= plate2MaxElevationSafe &&
            plate1MaxElevationSafe >= plate2MinElevationSafe) ||
          (plate2MinElevationSafe <= plate1MaxElevationSafe &&
            plate2MaxElevationSafe >= plate1MinElevationSafe);

        if (hasVerticalOverlap) {
          // Calculate repulsion force based on distance and overlap
          const overlapRatio = Math.min(
            (plate1MaxElevationSafe - plate2MinElevationSafe) /
              (plate1MaxElevationSafe - plate1MinElevationSafe),
            (plate2MaxElevationSafe - plate1MinElevationSafe) /
              (plate2MaxElevationSafe - plate2MinElevationSafe),
          );

          // Base repulsion strength based on distance and overlap
          const baseRepulsionStrength = 0.2 * sumOfRadii * (1 + overlapRatio);
          const baseRepulsionForceMagnitude =
            baseRepulsionStrength / (distance * distance);

          // Calculate total mass and mass ratios for distributing force
          const totalMass = plate1.mass + plate2.mass;

          // Avoid division by zero if total mass is somehow 0 or undefined
          if (!totalMass || totalMass === 0) continue;

          // Mass ratio for how much force plate1 *receives* (scaled by plate2's mass)
          const massRatio1 = plate2.mass / totalMass;
          // Mass ratio for how much force plate2 *receives* (scaled by plate1's mass)
          const massRatio2 = plate1.mass / totalMass;

          // Calculate distributed repulsion force magnitudes
          const repulsionForce1Magnitude =
            baseRepulsionForceMagnitude * massRatio1;
          const repulsionForce2Magnitude =
            baseRepulsionForceMagnitude * massRatio2;

          // Calculate direction vector between plates
          const direction = new Vector3()
            .subVectors(plate2.position, plate1.position)
            .normalize();

          // Accumulate forces before applying
          forces
            .get(plate1.id)
            ?.add(direction.clone().multiplyScalar(repulsionForce1Magnitude));
          forces
            .get(plate2.id)
            ?.add(direction.clone().multiplyScalar(-repulsionForce2Magnitude));
        }
      }
    }

    // Apply accumulated forces to update positions
    plates.forEach((plate) => {
      const force = forces.get(plate.id);
      if (force) {
        // Update position based on force (scaled by delta time if needed, but for layout we might apply fully)
        // For simplicity in visualization, let's just apply the force as a position change for now.
        // In a real simulation step, you'd use velocity and delta time.
        const newPosition = plate.position
          .clone()
          .add(force.multiplyScalar(this._deltaTime)); // Use _deltaTime for scaling

        // Normalize position to maintain sphere surface constraint
        plate.position.copy(
          newPosition.normalize().multiplyScalar(planetRadius),
        );
      }
    });

    // Return the calculated forces for visualization
    return forces;
  }
}
