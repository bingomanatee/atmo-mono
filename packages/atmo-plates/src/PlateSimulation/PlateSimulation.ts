import { EARTH_RADIUS, randomNormal } from '@wonderlandlabs/atmo-utils';
import { Multiverse } from '@wonderlandlabs/multiverse';
import { v4 as uuidV4 } from 'uuid';
import type { Vector3Like } from 'three';
import { PlateSpectrumGenerator } from '../generator/PlateSpectrumGenerator';
import { COLLECTIONS, UNIVERSAL_SCHEMA, UNIVERSES } from '../schema';
import type {
  Identifiable,
  PlateIF,
  PlateExtendedIF,
  SimSimulation,
  PlanetIF,
  SimPlanetIF,
} from '../types.atmo-plates';
import { simUniverse } from '../utils';
import { extendPlate } from '../utils/plateUtils';
import { isPlateExtendedIF } from '../typeGuards';
import type {
  PlateSimulationIF,
  PlateSimulationProps,
  SimPlateIF,
  SimProps,
  AddPlateProps,
} from './types.PlateSimulation';
import PlateSimulationPlateManager from './managers/PlateSimulationPlateManager';
import { PlateletManager } from './managers/PlateletManager';

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
  }

  /**
   * Initialize the simulation
   * This is separate from the constructor to allow for future async initialization
   */
  init(): void {
    // The basic properties are already initialized in the constructor

    // If simulationId is provided, load that specific simulation
    if (this.simulationId) {
      // Set the default simulation ID if not already set
      if (!this.#defaultSimId) {
        this.#defaultSimId = this.simulationId;
      }

      this.loadExistingSimulation(this.simulationId);
    } else {
      this.setupNewSimulation(this.#initPlateCount);
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

    // Get the plateCount from the simulation record
    const plateCount = simulation.plateCount;

    // Check if we need to generate plates
    if (plateCount) {
      // Count existing plates for this planet
      const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);

      // Check if there are any plates for this planet
      let hasPlatesForPlanet = false;
      for (const { value } of platesCollection.getAll()) {
        if (value.planetId === planetId) {
          hasPlatesForPlanet = true;
          break;
        }
      }

      // Only generate plates if there are none for this planet
      if (!hasPlatesForPlanet) {
        const { plates } = this.plateGenerator(plateCount).generate();

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
   */
  private setupNewSimulation(plateCount: number = 0): void {
    // Check if a simulation exists, if not create one
    const simulationsCollection = this.simUniv.get(COLLECTIONS.SIMULATIONS);

    // Check if we already have a default simulation ID
    if (this.#defaultSimId && simulationsCollection.has(this.#defaultSimId)) {
      // Get the simulation
      const simulation = this.simulation;
      let plateCount = simulation.plateCount;

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

          // Update the simulation with the new planet ID
          simulationsCollection.set(this.#defaultSimId, {
            ...simulation,
            planetId: this.planet.id,
          });
        }
      } else {
        // If the simulation doesn't have a planetId, create a planet and update the simulation
        this.planet = this.makePlanet(this.planetRadius);

        simulationsCollection.set(this.#defaultSimId, {
          ...simulation,
          planetId: this.planet.id,
        });
      }
    } else {
      // If no simulation exists, check if a planet exists
      const planetsCollection = this.simUniv.get(COLLECTIONS.PLANETS);
      let planetFound = false;

      // Try to find an existing planet
      for (const { value } of planetsCollection.getAll()) {
        this.planet = value;
        planetFound = true;
        break;
      }

      // If no planet exists, create one
      if (!planetFound) {
        this.planet = this.makePlanet(this.planetRadius);
      }

      // Create a new simulation with the plateCount
      this.addSimulation({
        planetId: this.planet!.id,
        plateCount: plateCount,
      });
    }

    // Check if there are already plates in the universe
    const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);
    const existingPlatesCount = platesCollection.count();

    // Generate plates if the simulation has a plateCount and there are none already
    if (plateCount > 0 && existingPlatesCount === 0) {
      const { plates } = this.plateGenerator(plateCount).generate();

      for (const plate of plates) {
        this.addPlate(plate);
      }
    }
  }

  plateGenerator(plateCount: number) {
    return new PlateSpectrumGenerator({
      planetRadius: this.planetRadius,
      plateCount: plateCount,
    });
  }

  get simUniv() {
    return this.multiverse.get(this.universeName)!;
  }

  addSimulation(props: SimProps): string {
    let { name, id, radius, planetId, plateCount = 0 } = props;

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

  getPlate(id: string): SimPlateIF | undefined {
    return this.simUniv.get(COLLECTIONS.PLATES).get(id);
  }

  getPlanet(id: string): SimPlanetIF | undefined {
    return this.simUniv.get(COLLECTIONS.PLANETS).get(id);
  }

  planet: SimPlanetIF | undefined;

  makePlanet(radius = this.planetRadius, name?: string): SimPlanetIF {
    if (radius < 1000) {
      throw new Error('planet radii must be >= 1000km');
    }
    const id = uuidV4();
    const planetData: SimPlanetIF = {
      id,
      radius,
      name,
    };

    // Set the planet data in the collection
    this.simUniv.get(COLLECTIONS.PLANETS).set(id, planetData);

    // Get the planet data back to verify it was set
    const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(id);

    if (!planet) {
      throw new Error(`Planet ${id} not found`);
    }

    return planet;
  }
}
