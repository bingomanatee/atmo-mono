import { EARTH_RADIUS, randomNormal } from '@wonderlandlabs/atmo-utils';
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
import { simUniverse } from '../utils';
import { extendPlate, isostaticElevation } from '../utils/plateUtils';
import { COLLECTIONS } from './constants';
import { PlateletManager } from './managers/PlateletManager';
import PlateSimulationPlateManager from './managers/PlateSimulationPlateManager';
import { Planet } from './Planet';
import type { Platelet } from './schemas/platelet';
import type {
  AddPlateProps,
  PlateSimulationIF,
  PlateSimulationProps,
  SimPlateIF,
  SimProps,
} from './types.PlateSimulation';

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

      // Run force-directed layout to separate overlapping plates
      this.runForceDirectedLayout(400);
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
      if (!this.planet) {
        throw new Error(
          'No planet available and no planetId or radius provided',
        );
      }
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

      // If we still don't have a planetId, use the current planet
      if (!planetId) {
        if (!this.planet) {
          throw new Error('No planet available and no planetId provided');
        }
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
   * Run force-directed layout for a specified number of steps to separate overlapping plates
   * @param maxSteps - Maximum number of force-directed steps to run (default: 400)
   */
  public runForceDirectedLayout(maxSteps: number = 400): void {
    for (let step = 0; step < maxSteps; step++) {
      const forces = this.applyForceLayout();

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
  public applyForceLayout(): Map<string, Vector3> {
    // Get plates for THIS simulation only
    const platesCollection = this.simUniv.get(COLLECTIONS.PLATES);
    const forces = new Map<string, Vector3>();

    // Initialize forces map using find generator
    for (const [id, plate] of platesCollection.find(
      'planetId',
      this.planet?.id,
    )) {
      forces.set(id, new Vector3());
    }

    // Calculate forces between all pairs of plates using nested generators
    for (const [id1, plate1] of platesCollection.find(
      'planetId',
      this.planet?.id,
    )) {
      for (const [id2, plate2] of platesCollection.find(
        'planetId',
        this.planet?.id,
      )) {
        // Skip same plate and avoid duplicate pairs
        if (id1 >= id2) continue;

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

    // Apply accumulated forces to update positions using find generator again
    const deltaTime = 2.0; // Even larger time step for breaking through force equilibrium
    for (const [id, plate] of platesCollection.find(
      'planetId',
      this.planet?.id,
    )) {
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
        platesCollection.set(id, {
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
   */
  populatePlateletNeighbors(): void {
    console.time('  🔗 Getting platelets collection');
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }
    console.timeEnd('  🔗 Getting platelets collection');

    // Get all platelets as an array for easier processing
    console.time('  🔗 Converting to array');
    const platelets: Platelet[] = [];
    plateletsCollection.each((platelet: Platelet) => {
      platelets.push(platelet);
    });
    console.timeEnd('  🔗 Converting to array');
    console.log(
      `  Processing ${platelets.length} platelets for neighbor relationships`,
    );

    // For each platelet, find its neighbors based on spatial proximity
    console.time('  🔗 Computing neighbor relationships');
    platelets.forEach((platelet, index) => {
      if (index % 1000 === 0) {
        console.log(`    Processing platelet ${index}/${platelets.length}`);
      }

      const neighbors: string[] = [];

      platelets.forEach((otherPlatelet) => {
        if (platelet.id === otherPlatelet.id) return;

        // Only consider platelets from the same plate as potential neighbors
        if (platelet.plateId !== otherPlatelet.plateId) return;

        // Calculate distance between platelets
        const distance = platelet.position.distanceTo(otherPlatelet.position);

        // Consider platelets neighbors if they're within a reasonable distance
        // Use a threshold based on the average platelet radius
        const neighborThreshold = (platelet.radius + otherPlatelet.radius) * 2;

        if (distance <= neighborThreshold) {
          // Verify the neighbor actually exists in the collection
          if (plateletsCollection.has(otherPlatelet.id)) {
            neighbors.push(otherPlatelet.id);
          }
        }
      });

      // Update the platelet with its validated neighbors
      plateletsCollection.set(platelet.id, {
        ...platelet,
        neighbors,
      });
    });
    console.timeEnd('  🔗 Computing neighbor relationships');

    console.log('Neighbor relationships populated and validated');
  }

  /**
   * Refresh neighbor relationships by removing invalid neighbor IDs
   * This removes neighbors that don't exist in the collection or belong to different plates
   */
  refreshNeighbors(): void {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }

    let totalCleaned = 0;
    let totalNeighborsRemoved = 0;

    plateletsCollection.each((platelet: any) => {
      if (platelet.neighbors && platelet.neighbors.length > 0) {
        const originalLength = platelet.neighbors.length;

        // Filter out invalid neighbors
        const validNeighbors = platelet.neighbors.filter(
          (neighborId: string) => {
            // Check if neighbor exists in collection
            if (!plateletsCollection.has(neighborId)) {
              return false;
            }

            // Check if neighbor belongs to the same plate
            const neighbor = plateletsCollection.get(neighborId);
            if (neighbor && neighbor.plateId !== platelet.plateId) {
              return false;
            }

            return true;
          },
        );

        if (validNeighbors.length !== originalLength) {
          // Update the platelet with cleaned neighbor list
          plateletsCollection.set(platelet.id, {
            ...platelet,
            neighbors: validNeighbors,
          });
          totalCleaned++;
          totalNeighborsRemoved += originalLength - validNeighbors.length;
        }
      }
    });

    console.log(
      `Refreshed neighbors: cleaned ${totalCleaned} platelets, removed ${totalNeighborsRemoved} invalid neighbor references`,
    );
  }

  /**
   * Create irregular edges for larger plates by deleting edge platelets
   * For plates with 40+ platelets, uses 3 deletion patterns (20% each):
   * - 20% delete just the platelet
   * - 20% delete platelet + 1 neighbor
   * - 20% delete platelet + all neighbors
   * For smaller plates (30-39), uses simple 25% deletion.
   */
  createIrregularPlateEdges(): void {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }

    // Refresh neighbor relationships BEFORE edge detection to ensure accurate neighbor counts
    console.log('Refreshing neighbor relationships before edge detection...');
    this.refreshNeighbors();

    // Group platelets by plate
    const plateletsByPlate = new Map<string, any[]>();
    plateletsCollection.each((platelet: any) => {
      const plateId = platelet.plateId;
      if (!plateletsByPlate.has(plateId)) {
        plateletsByPlate.set(plateId, []);
      }
      plateletsByPlate.get(plateId)!.push(platelet);
    });

    let totalDeleted = 0;

    // Shuffle the plates to randomize processing order
    const plateEntries = Array.from(plateletsByPlate.entries());
    const shuffledPlateEntries = shuffle(plateEntries);

    // Process each plate individually in random order
    shuffledPlateEntries.forEach(([plateId, platelets]) => {
      const plateSize = platelets.length;

      if (plateSize <= 30) {
        console.log(
          `Plate ${plateId}: ${plateSize} platelets - too small, skipping edge deletion`,
        );
        return;
      }

      const deletedCount = this.createIrregularEdgesForPlate(
        plateId,
        platelets,
      );
      totalDeleted += deletedCount;

      console.log(
        `Plate ${plateId}: ${plateSize} platelets → deleted ${deletedCount} platelets (${((deletedCount / plateSize) * 100).toFixed(1)}%)`,
      );
    });

    console.log(`Total deleted across all plates: ${totalDeleted} platelets`);

    // Refresh neighbor relationships AFTER deletion to clean up any orphaned references
    console.log('Refreshing neighbor relationships after deletion...');
    this.refreshNeighbors();
  }

  /**
   * Create irregular edges for a specific plate
   */
  private createIrregularEdgesForPlate(
    plateId: string,
    platelets: any[],
  ): number {
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
      const neighborCount = platelet.neighbors ? platelet.neighbors.length : 0;
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

    // Use 60% of average neighbor count as the edge threshold
    const EDGE_NEIGHBOR_THRESHOLD = Math.floor(avgNeighborCount * 0.6);

    // Get edge platelets and add some randomness to break up uniform patterns
    let edgePlatelets = plateletNeighborCounts.filter(
      (item) => item.neighborCount <= EDGE_NEIGHBOR_THRESHOLD,
    );

    // If we have too many edge platelets, randomly select a subset to create more varied patterns
    if (edgePlatelets.length > plateSize * 0.4) {
      const shuffledEdges = shuffle(edgePlatelets);
      edgePlatelets = shuffledEdges.slice(0, Math.floor(plateSize * 0.4));
    }

    // Get some stats for logging
    const minNeighborCount = plateletNeighborCounts[0]?.neighborCount || 0;
    const maxNeighborCount =
      plateletNeighborCounts[plateletNeighborCounts.length - 1]
        ?.neighborCount || 0;

    // Log detailed info about this plate
    console.log(
      `  Plate ${plateId}: ${plateSize} platelets, ${edgePlatelets.length} edge platelets (≤${EDGE_NEIGHBOR_THRESHOLD} neighbors, 60% of avg ${avgNeighborCount.toFixed(1)})`,
    );
    console.log(
      `    Neighbor stats: Min: ${minNeighborCount}, Max: ${maxNeighborCount}, Avg: ${avgNeighborCount.toFixed(1)}`,
    );

    if (edgePlatelets.length === 0) {
      console.log(`  No edge platelets found for plate ${plateId}, skipping`);
      return 0;
    }

    // Shuffle the edge platelets for random selection
    const shuffledEdgePlatelets = shuffle(edgePlatelets);
    const allPlateletsToDelete = new Set<string>();

    if (plateSize >= 40) {
      // For large plates (40+ platelets): Use aggressive recursive deletion
      // Take 12.5% of edge platelets and recursively delete neighbors up to 4 levels deep
      const deleteCount = Math.floor(shuffledEdgePlatelets.length * 0.125);
      const plateletsToDelete = shuffledEdgePlatelets.slice(0, deleteCount);

      console.log(
        `    Large plate: deleting ${deleteCount} of ${shuffledEdgePlatelets.length} edge platelets (12.5%) with recursive 50% neighbor deletion`,
      );

      // For each selected edge platelet, delete it and recursively delete 50% of its neighbors
      plateletsToDelete.forEach((item) => {
        this.recursivelyDeleteNeighbors(
          item.id,
          allPlateletsToDelete,
          0,
          4,
          platelets,
        );
      });

      console.log(
        `    Recursive deletion resulted in ${allPlateletsToDelete.size} total platelets marked for deletion`,
      );
    } else {
      // For smaller plates (30-39 platelets): Use simple 12.5% deletion
      const deleteCount = Math.floor(shuffledEdgePlatelets.length * 0.125);
      const plateletsToDelete = shuffledEdgePlatelets.slice(0, deleteCount);

      console.log(
        `    Medium plate: deleting ${deleteCount} of ${shuffledEdgePlatelets.length} edge platelets (12.5%)`,
      );

      plateletsToDelete.forEach((item) => {
        allPlateletsToDelete.add(item.id);
      });
    }

    // Delete the selected platelets
    allPlateletsToDelete.forEach((plateletId) => {
      plateletsCollection.delete(plateletId);
    });

    // Clean up neighbor lists - remove invalid platelet IDs from remaining platelets' neighbor lists
    console.log(`    Cleaning up neighbor lists...`);
    this.cleanupNeighborLists();

    // Return the number of deleted platelets for this plate
    return allPlateletsToDelete.size;
  }

  /**
   * Recursively delete neighbors up to a specified depth
   */
  private recursivelyDeleteNeighbors(
    plateletId: string,
    deletedSet: Set<string>,
    currentDepth: number,
    maxDepth: number,
    platelets: any[],
  ): void {
    // Add this platelet to deletion set
    deletedSet.add(plateletId);

    // Stop if we've reached max depth
    if (currentDepth >= maxDepth) {
      return;
    }

    // Find the platelet in our local array
    const platelet = platelets.find((p) => p.id === plateletId);
    if (!platelet || !platelet.neighbors) {
      return;
    }

    // Get 50% of neighbors (randomly selected)
    const neighbors = platelet.neighbors.filter(
      (neighborId: string) => !deletedSet.has(neighborId),
    );
    const neighborsToDelete = Math.ceil(neighbors.length * 0.5);
    const shuffledNeighbors = shuffle(neighbors);
    const selectedNeighbors = shuffledNeighbors.slice(0, neighborsToDelete);

    // Recursively delete selected neighbors
    selectedNeighbors.forEach((neighborId: string) => {
      if (!deletedSet.has(neighborId)) {
        this.recursivelyDeleteNeighbors(
          neighborId,
          deletedSet,
          currentDepth + 1,
          maxDepth,
          platelets,
        );
      }
    });
  }

  /**
   * Clean up neighbor lists by removing neighbor IDs that don't exist in the collection
   * This method finds all plates in the simulation and validates all neighbor references
   */
  cleanupNeighborLists(): void {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      return;
    }

    let cleanedCount = 0;
    let totalNeighborsRemoved = 0;

    plateletsCollection.each((platelet: any) => {
      if (platelet.neighbors && platelet.neighbors.length > 0) {
        const originalLength = platelet.neighbors.length;

        // Filter out neighbor IDs that don't exist in the collection
        const validNeighbors = platelet.neighbors.filter(
          (neighborId: string) => {
            // Check if the neighbor platelet actually exists in the collection
            return plateletsCollection.has(neighborId);
          },
        );

        if (validNeighbors.length !== originalLength) {
          // Update the platelet with cleaned neighbor list
          plateletsCollection.set(platelet.id, {
            ...platelet,
            neighbors: validNeighbors,
          });
          cleanedCount++;
          totalNeighborsRemoved += originalLength - validNeighbors.length;
        }
      }
    });

    console.log(
      `    Cleaned neighbor lists: updated ${cleanedCount} platelets, removed ${totalNeighborsRemoved} invalid neighbor references`,
    );
  }
}
