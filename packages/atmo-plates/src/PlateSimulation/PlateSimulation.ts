import {
  cellToVector,
  EARTH_RADIUS,
  getCellsInRange,
  getNeighborsAsync,
  randomNormal,
} from '@wonderlandlabs/atmo-utils';
import { Multiverse } from '@wonderlandlabs/multiverse';
import { shuffle } from 'lodash-es';
import type { Vector3Like } from 'three';
import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import { PlateSpectrumGenerator } from '../generator/PlateSpectrumGenerator';
import { UNIVERSAL_SCHEMA, UNIVERSES } from '../schema';
import { isPlateExtendedIF } from '../typeGuards';
import type {
  PlateExtendedIF,
  PlateIF,
  SimPlanetIF,
  SimSimulation,
} from '../types.atmo-plates';
import { simUniverse, clearExistingAtmoPlatesDatabases } from '../utils';
import { extendPlate, isostaticElevation } from '../utils/plateUtils';
import { COLLECTIONS } from './constants';
import { PlateletManager } from './managers/PlateletManager';
import PlateSimulationPlateManager from './managers/PlateSimulationPlateManager';
import { Planet } from './Planet';
import { Plate } from './Plate';
import type {
  AddPlateProps,
  PlateletIF,
  PlateSimulationIF,
  PlateSimulationProps,
  SimPlateIF,
  SimProps,
} from './types.PlateSimulation';
import { createPlateletFromCell } from './utils/plateletUtils';

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
  // Static property to control force-directed layout strength (0-1 scale)
  public static fdStrength: number = 0.33;

  readonly multiverse: Multiverse;
  readonly universeName: string;
  public planetRadius: number;
  public simulationId?: string;
  #defaultSimId: string | undefined;
  readonly managers: Map<string, any>; // Map to store manager instances
  #l0NeighborCache: Map<string, string[]> = new Map(); // Cache for L0 cell neighbors
  #step: number = 0;
  #maxPlateRadius: number | undefined;
  #useSharedStorage: boolean = false; // Flag for shared IndexedDB storage
  public deletedPlatelets: Set<string> = new Set(); // Track platelets flagged as "deleted" for visualization

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
      useSharedStorage = false, // Extract useSharedStorage flag
      useWorkers = true, // Enable workers by default for better performance
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

    // Note: Universe initialization will be handled in init() method

    // Initialize managers
    this.managers = new Map<string, any>();
    this.managers.set(MANAGERS.PLATE, new PlateSimulationPlateManager(this));
    this.managers.set(MANAGERS.PLATELET, new PlateletManager(this, useWorkers)); // Use the useWorkers flag

    // Store maxPlateRadius and useSharedStorage
    this.#maxPlateRadius = maxPlateRadius;
    this.#useSharedStorage = useSharedStorage;
  }

  /**
   * Clear all existing databases - call this before init() if you want a fresh start
   */
  async clearDatabases(): Promise<void> {
    await clearExistingAtmoPlatesDatabases();
  }

  /**
   * Initialize the simulation
   * This is separate from the constructor to allow for future async initialization
   * NOTE: This will NOT clear existing databases - call clearDatabases() first if needed
   */
  async init(): Promise<void> {
    // Initialize the simulation universe if it doesn't exist
    if (!this.multiverse.has(this.universeName)) {
      await simUniverse(this.multiverse, this.#useSharedStorage);
    }

    const plateManager = new PlateSimulationPlateManager(this);
    this.managers.set(MANAGERS.PLATE, plateManager);

    const plateletManager = new PlateletManager(this, true); // Enable workers by default for better performance
    this.managers.set(MANAGERS.PLATELET, plateletManager);

    // The basic properties are already initialized in the constructor

    // If simulationId is provided, load that specific simulation
    if (this.simulationId) {
      // Set the default simulation ID if not already set
      if (!this.#defaultSimId) {
        this.#defaultSimId = this.simulationId;
      }

      await this.loadExistingSimulation(this.simulationId);
    } else {
      // Pass maxPlateRadius to setupNewSimulation
      await this.setupNewSimulation(this.#initPlateCount, this.#maxPlateRadius);
    }
  }

  /**
   * Load an existing simulation by ID
   */
  private async loadExistingSimulation(simulationId: string): Promise<void> {
    // Get the simulation
    const simulationsCollection = this.simUniv.get(COLLECTIONS.SIMULATIONS);
    const simulation = simulationsCollection.get(simulationId);

    if (!simulation) {
      throw new Error(`Simulation ${simulationId} not found`);
    }
    this.simulation = simulation;

    // Set as default simulation
    this.#defaultSimId = simulationId;

    // Get the planet from the simulation
    const planetId = simulation.planetId;
    // @TODO: check for empty planetId
    const planetsCollection = this.simUniv.get(COLLECTIONS.PLANETS);
    const planet = planetsCollection.get(planetId);

    if (!planet) {
      throw new Error(
        `Planet ${planetId} not found for simulation ${simulationId}`,
      );
    }

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

        // Add plates in parallel for better performance
        const platePromises = plates.map((plate) =>
          this.addPlate(
            {
              ...plate,
              planetId,
            },
            simulationId,
          ),
        );
        await Promise.all(platePromises);
      }
    }
  }

  /**
   * Set up a new simulation if none is specified
   * @param plateCount - Number of plates to generate
   * @param maxPlateRadius - Optional maximum plate radius in radians
   */
  private async setupNewSimulation(
    plateCount: number = 0,
    maxPlateRadius?: number,
  ): Promise<void> {
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
          // Planet exists, no need to set anything - we'll use simulation.planetId
        } else {
          // If the planet doesn't exist but the simulation references it, create a new one
          console.warn(
            `Planet ${simulation.planetId} referenced in simulation ${this.#defaultSimId} not found. Creating a new planet.`,
          );
          const newPlanet = this.makePlanet(this.planetRadius);

          // Update the simulation with the new planet ID
          await simulationsCollection.mutate(this.#defaultSimId, (sim) => {
            return { ...sim, planetId: newPlanet.id };
          });
        }
      } else {
        // If the simulation doesn't have a planetId, create a planet and update the simulation
        const planet = this.makePlanet(this.planetRadius);

        simulationsCollection.set(this.#defaultSimId, {
          ...simulation,
          planetId: planet.id,
          maxPlateRadius: maxPlateRadius, // Include maxPlateRadius
        });
        this.simulation = await simulationsCollection.get(this.#defaultSimId);
        this.simulationId = this.#defaultSimId;
      }
    } else {
      // If no simulation exists, create a new planet
      const planet = await this.makePlanet(this.planetRadius);

      // Create a new simulation with the plateCount and maxPlateRadius
      await this.addSimulation({
        planetId: planet.id,
        plateCount: plateCount,
        maxPlateRadius: maxPlateRadius, // Include maxPlateRadius
      });
    }

    // Check if there are already plates in the universe
    const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);
    const existingPlatesCount = 0; // For now, assume no plates exist to force generation

    // Generate plates if the simulation has a plateCount and there are none already
    if (plateCount > 0 && existingPlatesCount === 0) {
      // Pass maxPlateRadius to plateGenerator
      const { plates } = this.plateGenerator(
        plateCount,
        maxPlateRadius,
      ).generate();

      for (let i = 0; i < plates.length; i++) {
        const plate = plates[i];
        await this.addPlate(plate);
      }

      // Run force-directed layout to separate overlapping plates
      await this.runForceDirectedLayout(400);
    }
  }

  plateGenerator(plateCount: number, maxPlateRadius?: number) {
    return new PlateSpectrumGenerator({
      planetRadius: this.planetRadius, // Convert from meters to kilometers - PlateSpectrumGenerator expects km
      plateCount: plateCount,
      maxPlateRadius: maxPlateRadius, // Pass maxPlateRadius to the generator
    });
  }

  get simUniv() {
    const universe = this.multiverse.get(this.universeName);
    if (!universe) {
      throw new Error(
        `Universe '${this.universeName}' not initialized. Call init() first.`,
      );
    }
    return universe;
  }

  async planet(): Promise<Planet> {
    const planetId = this.simulation?.planetId;
    if (!planetId) {
      console.warn('no planet for simulation', this.simulation);
      throw new Error('no plnanet id in simulation');
    }
    const planetsCollection = this.simUniv.get(COLLECTIONS.PLANETS);
    return planetsCollection.get(planetId)!;
  }

  async addSimulation(props: SimProps): string {
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
      const planet = await this.makePlanet(radius);
      planetId = planet.id;
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

    this.simulation = await this.simUniv.get(COLLECTIONS.SIMULATIONS).get(id);

    return id;
  }

  /**
   * Get the current simulation
   * @returns The simulation object
   */
  get step(): number {
    return this.#step;
  }

  simulation!: SimSimulation;

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
  async addPlate(props: AddPlateProps, simId?: string): Promise<string> {
    // Extract properties with defaults
    let {
      id,
      name,
      radians,
      radius,
      density = 1,
      thickness = 1,
      planetId,
      position,
    } = props;

    // Generate ID if not provided
    if (!id) id = uuidV4();

    // Generate name if not provided
    if (!name) name = `plate-${id}`;

    // If planetId is provided, verify it exists
    if (planetId) {
      const planet = await this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
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
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Simulation ${simId} not found: ${errorMessage}`);
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

      // If we still don't have a planetId, use the simulation's planetId
      if (!planetId) {
        if (!this.simulation?.planetId) {
          throw new Error('No planet available and no planetId provided');
        }
        planetId = this.simulation.planetId;
      }
    }

    // Verify the planet exists (final check)
    const planet = await this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
    if (!planet) {
      throw new Error(`Planet ${planetId} not found`);
    }

    // Create position vector on the planet surface
    let finalPosition: Vector3;
    if (position) {
      // If position is provided, normalize it to the planet surface
      if (position instanceof Vector3) {
        finalPosition = position.normalize().multiplyScalar(planet.radius);
      } else {
        // Convert plain object to Vector3 and normalize
        finalPosition = new Vector3(position.x, position.y, position.z)
          .normalize()
          .multiplyScalar(planet.radius);
      }
    } else {
      // Generate random position if none provided
      finalPosition = randomNormal().setLength(planet.radius);
    }

    // Create the plate object with SimPlateIF interface
    let plateData: SimPlateIF;

    if (isPlateExtendedIF(props)) {
      // If it's already an extended plate, just add the simulation-specific properties
      plateData = {
        ...(props as PlateExtendedIF),
        id,
        name,
        planetId,
        position: finalPosition,
      };
    } else {
      // If it's a basic plate, extend it with derived properties
      // Convert radius from radians to kilometers (same as PlateSpectrumGenerator)
      const radiusKm = radius ? radius : radians * planet.radius;

      const basicPlate: PlateIF & { id: string } = {
        id,
        radius: radiusKm,
        density,
        thickness,
      };

      // Extend the plate with derived properties
      const extendedPlate = extendPlate(basicPlate, planet.radius);

      plateData = {
        ...extendedPlate,
        name,
        planetId,
        position: finalPosition,
      };
    }

    // Add the plate to the collection
    const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);
    await platesCollection.set(id, plateData);

    // Verify the plate was actually stored
    const storedPlate = await platesCollection.get(id);
    if (!storedPlate) {
      console.error(
        `❌ PlateSimulation: Failed to store plate ${id} in database`,
      );
    }

    // TODO: Auto-integration disabled due to validation issues
    // Edge deletion flagging can be applied manually after platelet generation

    return id;
  }

  async getPlate(id: string): Promise<Plate> {
    const plate = await this.simUniv.get(COLLECTIONS.PLATES).get(id);
    if (!plate) throw new Error('cannot find plate ' + id);
    return plate as Plate; // filterRecord ensures this is a Plate instance
  }

  async getPlanet(id: string): Promise<Planet> {
    const planetData = await this.simUniv.get(COLLECTIONS.PLANETS).get(id);
    if (!planetData) throw new Error('cannot find planet ' + id);
    return Planet.fromJSON(planetData);
  }

  makePlanet(radius = this.planetRadius, name?: string): SimPlanetIF {
    // radius is already in kilometers from EARTH_RADIUS constant
    if (radius < 1000) {
      throw new Error('planet radii must be >= 1000km');
    }

    const planet = new Planet({ radius, name });

    // Set the planet data in the collection
    this.simUniv.get(COLLECTIONS.PLANETS).set(planet.id, planet.toJSON());

    return planet;
  }

  /**
   * Run force-directed layout for a specified number of steps to separate overlapping plates
   * @param maxSteps - Maximum number of force-directed steps to run (default: 400)
   */
  public async runForceDirectedLayout(maxSteps: number = 400): Promise<void> {
    for (let step = 0; step < maxSteps; step++) {
      const forces = await this.applyForceLayout();

      // Check if forces are minimal (simulation has stabilized)
      let maxForce = 0;
      forces.forEach((force) => {
        maxForce = Math.max(maxForce, force.length());
      });

      // Stop early if forces are very small (stabilized)
      if (maxForce < 1.0) {
        break;
      }
    }
  }

  /**
   * Apply a force-directed layout to the plates based on density similarity.
   * This method modifies the positions of the plates within the simulation.
   * @returns A map of plate ID to the calculated force vector for that plate.
   */
  public async applyForceLayout(): Promise<Map<string, Vector3>> {
    // Get plates for THIS simulation only
    const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);
    const forces = new Map<string, Vector3>();

    // Collect all plates first to avoid async generator race conditions
    const plates: Array<[string, any]> = [];
    for await (const [id, plate] of platesCollection.find(
      'planetId',
      this.simulation.planetId,
    )) {
      plates.push([id, plate]);
      forces.set(id, new Vector3());
    }

    // Calculate forces between all pairs of plates synchronously
    for (let i = 0; i < plates.length; i++) {
      const [id1, plate1] = plates[i];
      for (let j = i + 1; j < plates.length; j++) {
        const [id2, plate2] = plates[j];

        // Calculate distance between plates (all in km)
        const pos1 = new Vector3(
          plate1.position.x,
          plate1.position.y,
          plate1.position.z,
        );
        const pos2 = new Vector3(
          plate2.position.x,
          plate2.position.y,
          plate2.position.z,
        );
        const distance = pos1.distanceTo(pos2);

        // Calculate combined radius (already in km)
        const combinedRadius = plate1.radius + plate2.radius;

        // Calculate elevation for both plates using dynamic calculation
        const plate1Elevation = isostaticElevation(
          plate1.thickness,
          plate1.density,
        );
        const plate2Elevation = isostaticElevation(
          plate2.thickness,
          plate2.density,
        );

        const elevationDifference = Math.abs(plate1Elevation - plate2Elevation);
        const maxElevationDifference =
          (plate1.thickness + plate2.thickness) / 2;

        // If elevation difference is too large, plates don't interact
        if (elevationDifference > maxElevationDifference) {
          continue;
        }

        // Check if plates are overlapping or too close
        if (distance < combinedRadius * 1.2) {
          // 20% buffer
          // Calculate base repulsion force magnitude based on elevation interaction
          const baseRepulsionForceMagnitude = 500; // Increased base force in km for more visible movement

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

          // Calculate direction from plate2 to plate1 (repulsion direction for plate1)
          const direction1 = pos1.clone().sub(pos2).normalize();
          // Direction from plate1 to plate2 (repulsion direction for plate2)
          const direction2 = direction1.clone().negate();

          // Apply forces
          const force1 = direction1.multiplyScalar(repulsionForce1Magnitude);
          const force2 = direction2.multiplyScalar(repulsionForce2Magnitude);

          // Accumulate forces
          forces.get(id1)!.add(force1);
          forces.get(id2)!.add(force2);
        }
      }
    }

    // Apply accumulated forces to update positions using collected plates
    const deltaTime = 2.0; // Even larger time step for breaking through force equilibrium
    for (const [id, plate] of plates) {
      const force = forces.get(id);
      if (force && force.length() > 0.001) {
        // Apply force dampening using fdStrength (0-1 scale)
        const dampenedForce = force
          .clone()
          .multiplyScalar(PlateSimulation.fdStrength);

        // Update position based on dampened force with fixed time step
        const newPosition = new Vector3(
          plate.position.x,
          plate.position.y,
          plate.position.z,
        ).add(dampenedForce.multiplyScalar(deltaTime));

        // Normalize position to maintain sphere surface constraint
        const normalizedPosition = newPosition
          .normalize()
          .multiplyScalar(this.planetRadius);

        // Update the plate position in the collection
        await platesCollection.set(id, {
          ...plate,
          position: {
            x: normalizedPosition.x,
            y: normalizedPosition.y,
            z: normalizedPosition.z,
          },
        });
      }
    }

    // Return the calculated forces for visualization
    return forces;
  }

  /**
   * Populate neighbor relationships between platelets based on spatial proximity
   * This should be called after platelet generation to establish neighbor connections
   *
   * Refactored to be memory-efficient:
   * - Process one plate at a time instead of loading all platelets
   * - Use iterators instead of arrays
   * - Only compare platelets within the same plate
   */
  async populatePlateletNeighbors(): Promise<void> {
    console.time('  🔗 Getting collections');
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }
    if (!platesCollection) {
      throw new Error('plates collection not found');
    }
    console.timeEnd('  🔗 Getting collections');

    console.time('  🔗 Computing neighbor relationships');

    let totalPlateletsProcessed = 0;
    let totalPlatesProcessed = 0;
    const planet = await this.planet();
    const planetRadius = planet.radius;

    // a) Iterate over the plates
    for await (const [plateId, plate] of platesCollection.find(
      'planetId',
      this.simulation.planetId,
    )) {
      console.log(`Processing neighbors for plate ${plateId}...`);

      const result = await this.addEdgePlatelets(plateId, plate);

      totalPlateletsProcessed += result.plateletCount;
      totalPlatesProcessed++;

      console.log(
        `  Completed neighbors for plate ${plateId} (${result.plateletCount} platelets)`,
      );
    }

    console.timeEnd('  🔗 Computing neighbor relationships');
    console.log(
      `Neighbor relationships populated: ${totalPlatesProcessed} plates, ${totalPlateletsProcessed} platelets processed`,
    );
  }

  /**
   * Process neighbor relationships for a single plate
   */
  private async addEdgePlatelets(
    plateId: string,
    plate: any,
  ): Promise<{ plateletCount: number }> {
    const planet = await this.planet();
    const planetRadius = planet.radius;

    // Try to use workers for neighbor processing if available
    const plateletManager = this.managers.get(
      MANAGERS.PLATELET,
    ) as PlateletManager;
    if (plateletManager.workersEnabled && plateletManager.workersAvailable) {
      try {
        console.log(`Processing neighbors for plate ${plateId}...`);
        const result = await plateletManager.processNeighborsWithWorker(
          plateId,
          planetRadius,
        );
        console.log(
          `Found ${result.plateletCount} platelets for plate ${plateId}`,
        );
        console.log(
          `Completed neighbors for plate ${plateId} (${result.plateletCount} platelets)`,
        );
        return result;
      } catch (error) {
        console.warn(
          `⚠️ Worker neighbor processing failed, falling back to main thread:`,
          error,
        );
        // Fall through to main thread processing
      }
    }

    // Fallback to main thread processing
    let plateletCount = 0;
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);

    console.log(`Processing neighbors for plate ${plateId}...`);

    // Use real-time find with plateId - no intermediate data structures
    for await (const [
      currentPlateletId,
      currentPlatelet,
    ] of plateletsCollection.find('plateId', plateId)) {
      plateletCount++;

      // Perform gap-filling for this platelet
      await this.validUnrealizedPlateletNeighbors(currentPlatelet, plate);
    }

    console.log(`Found ${plateletCount} platelets for plate ${plateId}`);

    if (plateletCount < 2) {
      console.log(
        `Skipping plate ${plateId} - not enough platelets for neighbor relationships`,
      );
      return { plateletCount };
    }

    console.log(
      `Completed neighbors for plate ${plateId} (${plateletCount} platelets)`,
    );

    // Gap-filling is complete for this plate
    return { plateletCount };
  }

  /**
   * Find missing neighbors and create platelets to fill gaps
   * This is a gap-filling algorithm that ensures complete plate coverage
   */
  private async validUnrealizedPlateletNeighbors(
    platelet: PlateletIF,
    plate: SimPlateIF,
  ): Promise<string[]> {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);

    if (!platelet) {
      return [];
    }
    const planet = await this.planet();
    const { radius: planetRadius } = planet;

    // Step 1: Find missing neighbors for this platelet
    let coordinateList = await this.findMissingNeighborCoordinates(
      platelet,
      plate,
    );

    // Create platelets for all missing coordinates
    for (const h3Cell of coordinateList) {
      const plateletId = `${plate.id}-${h3Cell}`;

      // Create the missing platelet
      const newPlatelet = await createPlateletFromCell(
        h3Cell,
        plate,
        planetRadius,
        PlateletManager.PLATELET_CELL_LEVEL,
      );
      await plateletsCollection.set(plateletId, newPlatelet);
      const saved = plateletsCollection.fond(newPlatelet.id);

      await this.validUnrealizedPlateletNeighbors(saved, plate);
    }
  }

  /**
   * Find coordinates that should have platelets but don't exist yet
   */
  private async findMissingNeighborCoordinates(
    platelet: PlateletIF,
    plate: SimPlateIF,
  ): Promise<string[]> {
    const missingCoordinates: string[] = [];

    const planet = await this.planet();
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);

    if (!Array.isArray(platelet.neighborCellIds)) {
      console.warn(
        '⚠️ neighborCellIds is not an array, skipping platelet:',
        platelet,
      );
      return missingCoordinates; // Return empty array if not iterable
    }

    for (const neighborCell of platelet.neighborCellIds) {
      const neighborPosition = cellToVector(neighborCell, planet.radius);
      const distanceToPlateCenter = neighborPosition.distanceTo(plate.position);
      const neighborPlateletId = `${plate.id}-${neighborCell}`;

      if (distanceToPlateCenter <= plate.radius) {
        if (!(await plateletsCollection.has(neighborPlateletId))) {
          missingCoordinates.push(neighborCell);
        }
      }
    }

    return missingCoordinates;
  }

  /**
   * Find existing neighbors for a platelet (for the final neighbor list)
   */
  private async findExistingNeighbors(
    currentPlatelet: any,
    platePosition: Vector3,
    plateRadius: number,
    planetRadius: number,
    plateletsCollection: any,
    plateId: string,
  ): Promise<string[]> {
    const candidatesWithDistance: Array<{ id: string; distance: number }> = [];
    const neighborCells = await getNeighborsAsync(currentPlatelet.h3Cell);

    for (const neighborCell of neighborCells) {
      const neighborPosition = cellToVector(neighborCell, planetRadius);
      const distanceToPlateCenter = neighborPosition.distanceTo(platePosition);

      if (distanceToPlateCenter <= plateRadius) {
        const neighborPlateletId = `${plateId}-${neighborCell}`;

        // Only include if it exists (should exist now after gap filling)
        if (await plateletsCollection.has(neighborPlateletId)) {
          const distance =
            currentPlatelet.position.distanceTo(neighborPosition);
          candidatesWithDistance.push({
            id: neighborPlateletId,
            distance,
          });
        }
      }
    }

    // Sort by distance and take the 2 closest neighbors
    return candidatesWithDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)
      .map((candidate) => candidate.id);
  }

  /**
   * Write neighbor updates to the collection in batch
   */
  private async writeNeighborUpdates(
    neighborUpdates: Array<{ id: string; platelet: any; neighbors: string[] }>,
    plateletsCollection: any,
  ): Promise<void> {
    const writePromises = neighborUpdates.map(({ id, platelet, neighbors }) =>
      plateletsCollection.set(id, {
        ...platelet,
        neighbors,
      }),
    );
    await Promise.all(writePromises);
  }

  /**
   * Refresh neighbor relationships by validating neighborCellIds
   * This ensures all H3 cell IDs in neighborCellIds correspond to existing platelets
   * and removes references to platelets that have been marked as removed
   * Uses efficient has() checks and mutate() for updates
   */
  async refreshNeighbors(): Promise<void> {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }

    let totalCleaned = 0;
    let totalNeighborsRemoved = 0;

    // First, collect all platelets to avoid transaction timeout
    const allPlatelets: any[] = [];
    for await (const [_, platelet] of plateletsCollection.values()) {
      allPlatelets.push(platelet);
    }

    // Process platelets in smaller batches to avoid transaction timeouts
    const batchSize = 50;
    for (let i = 0; i < allPlatelets.length; i += batchSize) {
      const batch = allPlatelets.slice(i, i + batchSize);

      for (const platelet of batch) {
        // Skip platelets that are marked as removed
        if (platelet.removed) {
          continue;
        }

        if (platelet.neighborCellIds && platelet.neighborCellIds.length > 0) {
          const originalLength = platelet.neighborCellIds.length;

          // Filter out H3 cell IDs that don't have corresponding platelets or are marked as removed
          const validNeighborCells: string[] = [];
          for (const cellId of platelet.neighborCellIds) {
            const neighborPlateletId = `${platelet.plateId}-${cellId}`;

            // Check if neighbor exists and is not removed
            const neighborPlatelet =
              await plateletsCollection.get(neighborPlateletId);
            if (neighborPlatelet && !neighborPlatelet.removed) {
              validNeighborCells.push(cellId);
            }
          }

          if (validNeighborCells.length !== originalLength) {
            // Use mutate to update the platelet with cleaned neighborCellIds list
            await plateletsCollection.mutate(platelet.id, (draft: any) => {
              if (draft) {
                draft.neighborCellIds = validNeighborCells;
              }
              return draft;
            });
            totalCleaned++;
            totalNeighborsRemoved += originalLength - validNeighborCells.length;
          }
        }
      }
    }

    console.log(
      `🔗 Refreshed neighbors: cleaned ${totalCleaned} platelets, removed ${totalNeighborsRemoved} neighbor references`,
    );
  }

  /**
   * Create irregular edges for larger plates by deleting edge platelets
   */
  async createIrregularPlateEdges(): Promise<void> {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }

    // Refresh neighbor relationships BEFORE edge detection to ensure accurate neighbor counts
    await this.refreshNeighbors();

    // First collect all platelets to avoid transaction timeout
    const allPlatelets: any[] = [];
    for await (const [_, platelet] of plateletsCollection.values()) {
      allPlatelets.push(platelet);
    }

    // Group platelets by plate
    const plateletsByPlate = new Map<string, any[]>();
    for (const platelet of allPlatelets) {
      const plateId = platelet.plateId;
      if (!plateletsByPlate.has(plateId)) {
        plateletsByPlate.set(plateId, []);
      }
      plateletsByPlate.get(plateId)!.push(platelet);
    }

    let totalDeleted = 0;

    // Shuffle the plates to randomize processing order
    const plateEntries = Array.from(plateletsByPlate.entries());
    const shuffledPlateEntries = shuffle(plateEntries);

    // Process each plate individually in random order
    for (const [plateId, platelets] of shuffledPlateEntries) {
      const plateSize = platelets.length;

      if (plateSize <= 30) {
        continue;
      }

      const deletedCount = await this.createIrregularEdgesForPlate(
        plateId,
        platelets,
      );
      totalDeleted += deletedCount;
    }

    // Refresh neighbor relationships AFTER deletion to clean up any orphaned references
    await this.refreshNeighbors();
  }

  /**
   * Create irregular edges for a specific plate
   */
  private async createIrregularEdgesForPlate(
    plateId: string,
    platelets: any[],
  ): Promise<number> {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }

    const plateSize = platelets.length;

    // Get platelets for this specific plate and count their neighbors
    const plateletNeighborCounts: Array<{
      id: string;
      neighborCount: number;
      platelet: any;
    }> = [];

    platelets.forEach((platelet: any) => {
      const neighborCount = platelet.neighborCellIds
        ? platelet.neighborCellIds.length
        : 0;
      plateletNeighborCounts.push({
        id: platelet.id,
        neighborCount,
        platelet,
      });
    });

    // Sort by neighbor count (ascending) to find edge platelets
    plateletNeighborCounts.sort((a, b) => a.neighborCount - b.neighborCount);

    // Find edge platelets (those with fewer neighbors than average)
    // For these large, densely connected plates, we need a higher threshold
    const avgNeighborCount =
      plateletNeighborCounts.reduce(
        (sum, item) => sum + item.neighborCount,
        0,
      ) / plateletNeighborCounts.length;

    // Use 80% of average neighbor count as the edge threshold (more inclusive)
    const EDGE_NEIGHBOR_THRESHOLD = Math.floor(avgNeighborCount * 0.8);

    // Get edge platelets and add some randomness to break up uniform patterns
    let edgePlatelets = plateletNeighborCounts.filter(
      (item) => item.neighborCount <= EDGE_NEIGHBOR_THRESHOLD,
    );

    // If we have too many edge platelets, randomly select a subset to create more varied patterns
    if (edgePlatelets.length > plateSize * 0.4) {
      const shuffledEdges = shuffle(edgePlatelets);
      edgePlatelets = shuffledEdges.slice(0, Math.floor(plateSize * 0.4));
    }

    if (edgePlatelets.length === 0) {
      return 0;
    }

    // Shuffle the edge platelets for random selection
    const shuffledEdgePlatelets = shuffle(edgePlatelets);
    const allPlateletsToDelete = new Set<string>();

    // Calculate maximum allowed deletions (25% of total plate size for much better visualization)
    const maxAllowedDeletions = Math.max(2, Math.floor(plateSize * 0.25));

    if (plateSize >= 40) {
      // For large plates (40+ platelets): Use cascading deletion only (no initial edge accretion)
      const deleteCount = Math.min(
        Math.max(1, Math.floor(shuffledEdgePlatelets.length * 0.2)), // Reduced to 20% of edge platelets
        maxAllowedDeletions,
      );
      const plateletsToDelete = shuffledEdgePlatelets.slice(0, deleteCount);

      // For each selected edge platelet, apply cascading deletion to neighbors
      plateletsToDelete.forEach((item) => {
        this.limitedDeleteNeighbors(
          item.id,
          allPlateletsToDelete,
          platelets,
          maxAllowedDeletions,
        );
      });
    } else {
      // For medium plates (30-39 platelets): Use edge accretion only
      const deleteCount = Math.min(
        Math.max(2, Math.floor(shuffledEdgePlatelets.length * 0.4)), // Reduced to 40% of edge platelets
        maxAllowedDeletions,
      );
      const plateletsToDelete = shuffledEdgePlatelets.slice(0, deleteCount);

      // For medium plates, just delete the edge platelets themselves (no cascading)
      plateletsToDelete.forEach((item) => {
        allPlateletsToDelete.add(item.id);
      });
    }

    // Island detection: Remove edge platelets that have no non-destroyed neighbors
    const islandPlatelets = this.findIslandPlatelets(
      platelets,
      allPlateletsToDelete,
    );

    // Add island platelets to deletion set
    islandPlatelets.forEach((plateletId) => {
      allPlateletsToDelete.add(plateletId);
    });

    // Instead of deleting, flag platelets as "removed" in the schema
    for (const plateletId of allPlateletsToDelete) {
      await plateletsCollection.mutate(plateletId, (draft: any) => {
        if (draft) {
          draft.removed = true;
        }
        return draft;
      });
      // Also add to the Set for backward compatibility with visualization
      this.deletedPlatelets.add(plateletId);
    }

    // Return the number of flagged platelets for this plate
    return allPlateletsToDelete.size;
  }

  /**
   * Check if a platelet is flagged as deleted (for visualization)
   * This checks both the Set (for backward compatibility) and the schema
   */
  public isPlateletDeleted(plateletId: string): boolean {
    return this.deletedPlatelets.has(plateletId);
  }

  /**
   * Check if a platelet is marked as removed in the schema
   */
  public async isPlateletRemoved(plateletId: string): Promise<boolean> {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      return false;
    }

    const platelet = await plateletsCollection.get(plateletId);
    return platelet?.removed === true;
  }

  /**
   * Clear all deleted platelet flags
   */
  public clearDeletedPlatelets(): void {
    this.deletedPlatelets.clear();
  }

  /**
   * Get count of deleted platelets
   */
  public getDeletedPlateletCount(): number {
    return this.deletedPlatelets.size;
  }

  /**
   * Find island platelets - edge platelets that have no non-destroyed neighbors
   */
  private findIslandPlatelets(
    platelets: any[],
    deletedSet: Set<string>,
  ): string[] {
    const islandPlatelets: string[] = [];

    // Check all remaining (non-deleted) platelets
    for (const platelet of platelets) {
      if (deletedSet.has(platelet.id) || platelet.removed) {
        continue; // Skip already deleted or removed platelets
      }

      // Check if this platelet has any non-destroyed neighbors
      let hasLivingNeighbor = false;

      if (platelet.neighborCellIds && platelet.neighborCellIds.length > 0) {
        for (const cellId of platelet.neighborCellIds) {
          const neighborPlateletId = `${platelet.plateId}-${cellId}`;

          // Find the neighbor platelet in our local array
          const neighborPlatelet = platelets.find(
            (p) => p.id === neighborPlateletId,
          );

          // If this neighbor exists, is not deleted, and is not removed, platelet is not an island
          if (
            neighborPlatelet &&
            !deletedSet.has(neighborPlateletId) &&
            !neighborPlatelet.removed
          ) {
            hasLivingNeighbor = true;
            break;
          }
        }
      }

      // If no living neighbors, this is an island - mark for deletion
      if (!hasLivingNeighbor) {
        islandPlatelets.push(platelet.id);
      }
    }

    return islandPlatelets;
  }

  /**
   * Limited deletion of neighbors with hard cap on total deletions
   */
  private limitedDeleteNeighbors(
    plateletId: string,
    deletedSet: Set<string>,
    platelets: any[],
    maxAllowedDeletions: number,
  ): void {
    // Add this platelet to deletion set
    deletedSet.add(plateletId);

    // Stop if we've reached the maximum allowed deletions
    if (deletedSet.size >= maxAllowedDeletions) {
      return;
    }

    // Find the platelet in our local array
    const platelet = platelets.find((p) => p.id === plateletId);
    if (!platelet || !platelet.neighborCellIds) {
      return;
    }

    // Convert H3 cell IDs to platelet IDs and filter out already deleted or removed ones
    const neighbors = platelet.neighborCellIds
      .map((cellId: string) => `${platelet.plateId}-${cellId}`)
      .filter((neighborId: string) => {
        if (deletedSet.has(neighborId)) return false;
        // Also check if the neighbor is marked as removed in the platelets array
        const neighborPlatelet = platelets.find((p) => p.id === neighborId);
        return neighborPlatelet && !neighborPlatelet.removed;
      });

    // Calculate how many more we can delete
    const remainingDeletions = maxAllowedDeletions - deletedSet.size;

    // Delete at most 30% of neighbors for better cascading effect
    const neighborsToDelete = Math.min(
      Math.ceil(neighbors.length * 0.3),
      remainingDeletions,
    );

    if (neighborsToDelete > 0) {
      const shuffledNeighbors = shuffle(neighbors);
      const selectedNeighbors = shuffledNeighbors.slice(0, neighborsToDelete);

      // Add selected neighbors to deletion set
      selectedNeighbors.forEach((neighborId: string) => {
        deletedSet.add(neighborId);
      });
    }
  }
}
