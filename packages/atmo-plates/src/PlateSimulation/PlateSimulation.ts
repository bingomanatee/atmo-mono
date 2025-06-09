import {
  cellToVector,
  EARTH_RADIUS,
  getNeighborsAsync,
  randomNormal,
  varyP,
} from '@wonderlandlabs/atmo-utils';
import { asyncIterToMap, Universe } from '@wonderlandlabs/multiverse';
import { shuffle } from 'lodash-es';
import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import { PlateSpectrumGenerator } from '../generator/PlateSpectrumGenerator';
import { isPlateExtendedIF } from '../typeGuards';
import type {
  PlateExtendedIF,
  PlateIF,
  SimPlanetIF,
  SimSimulation,
} from '../types.atmo-plates';
import { extendPlate, isostaticElevation } from '../utils/plateUtils';
import { COLLECTIONS } from './constants';
import { ContextProvider, MANAGER_TYPES } from './interfaces/ContextProvider';
import { PlateletManager } from './managers/PlateletManager';
import PlateManager from './managers/PlateManager';
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

export class PlateSimulation implements PlateSimulationIF, ContextProvider {
  // Static property to control force-directed layout strength (0-1 scale)
  public static fdStrength: number = 0.33;

  readonly simUniv: Universe;

  // ContextProvider implementation
  get universe(): Universe {
    return this.simUniv;
  }

  public simulationId?: string;
  #defaultSimId: string | undefined;
  readonly managers: Map<string, any>; // Map to store manager instances
  #l0NeighborCache: Map<string, string[]> = new Map(); // Cache for L0 cell neighbors
  #step: number = 0;
  #maxPlateRadius: number | undefined;
  public deletedPlatelets: Set<string> = new Set(); // Track platelets flagged as "deleted" for visualization

  /**
   * Create a new plate simulation with an injected universe
   * @param simUniv - The universe instance to operate on
   * @param props - Configuration properties for the simulation
   */
  #initPlateCount: number;

  constructor(simUniv: Universe, props: PlateSimulationProps = {}) {
    // Extract properties with defaults
    const {
      simulationId,
      plateCount = 0,
      maxPlateRadius, // Extract maxPlateRadius
    } = props;

    // Initialize basic properties
    this.simUniv = simUniv;
    this.simulationId = simulationId;
    this.#initPlateCount = plateCount;

    // If simulationId is provided, set it as the default
    if (simulationId) {
      this.#defaultSimId = simulationId;
    }

    // Initialize managers with injected universe
    this.managers = new Map<string, any>();
    this.managers.set(MANAGER_TYPES.PLATE, new PlateManager(simUniv));
    this.managers.set(MANAGER_TYPES.PLATELET, new PlateletManager(simUniv));

    // Store maxPlateRadius
    this.#maxPlateRadius = maxPlateRadius;
  }

  // Database clearing is now handled externally by the application
  // PlateSimulation only lazy-creates tables/databases as needed

  /**
   * ContextProvider implementation - get a manager by name
   */
  getManager<T = any>(managerName: string): T {
    const manager = this.managers.get(managerName);
    if (!manager) {
      throw new Error(`Manager '${managerName}' not found in PlateSimulation`);
    }
    return manager as T;
  }

  /**
   * Initialize the simulation
   * Universe is already injected, so this just sets up the simulation data
   */
  async init(): Promise<void> {
    // Universe is already injected, managers are already created

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
        const generator = await this.plateGenerator(plateCount, maxPlateRadius);
        const { plates } = generator.generate();

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
          const newPlanet = this.makePlanet();

          // Update the simulation with the new planet ID
          await simulationsCollection.mutate(this.#defaultSimId, (sim) => {
            return { ...sim, planetId: newPlanet.id };
          });
        }
      } else {
        // If the simulation doesn't have a planetId, create a planet and update the simulation
        const planet = this.makePlanet();

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
      const planet = await this.makePlanet();

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
      const generator = await this.plateGenerator(plateCount, maxPlateRadius);
      const { plates } = generator.generate();

      for (let i = 0; i < plates.length; i++) {
        const plate = plates[i];
        await this.addPlate(plate);
      }

      // Run force-directed layout to separate overlapping plates
      await this.runForceDirectedLayout(400);
    }
  }

  async plateGenerator(plateCount: number, maxPlateRadius?: number) {
    const planet = await this.planet();
    return new PlateSpectrumGenerator({
      planetRadius: planet.radius, // Planet radius is already in kilometers
      plateCount: plateCount,
      maxPlateRadius: maxPlateRadius, // Pass maxPlateRadius to the generator
    });
  }

  // simUniv is now a direct property injected in constructor

  async planet(): Promise<Planet> {
    const planetId = this.simulation?.planetId;
    if (!planetId) {
      console.warn('no planet for simulation', this.simulation);
      throw new Error('no planet id in simulation');
    }
    const planetsCollection = this.simUniv.get(COLLECTIONS.PLANETS);
    return planetsCollection.get(planetId)!;
  }

  async addSimulation(props: SimProps): string {
    let { name, id, radius, planetId, plateCount = 0, maxPlateRadius } = props; // Extract maxPlateRadius

    if (!id) {
      id = uuidV4();
    }
    if (!name) {
      name = `sim-${id}`;
    }

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
    if (!id) {
      id = uuidV4();
    }

    // Generate name if not provided
    if (!name) {
      name = `plate-${id}`;
    }

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
          console.error('Error getting default simulation:', error);
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
    if (!plate) {
      throw new Error('cannot find plate ' + id);
    }
    return plate as Plate; // filterRecord ensures this is a Plate instance
  }

  async getPlanet(id: string): Promise<Planet> {
    const planetData = await this.simUniv.get(COLLECTIONS.PLANETS).get(id);
    if (!planetData) {
      throw new Error('cannot find planet ' + id);
    }
    return Planet.fromJSON(planetData);
  }

  makePlanet(radius = EARTH_RADIUS, name?: string): SimPlanetIF {
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
          if (!totalMass || totalMass === 0) {
            continue;
          }

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
        const planet = await this.planet();
        const normalizedPosition = newPosition
          .normalize()
          .multiplyScalar(planet.radius);

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
      const result = await this.addEdgePlatelets(plateId, plate);

      totalPlateletsProcessed += result.plateletCount;
      totalPlatesProcessed++;
    }

    console.timeEnd('  🔗 Computing neighbor relationships');
  }

  /**
   * Process neighbor relationships for a single plate
   */
  private async addEdgePlatelets(
    plateId: string,
    plate: any,
  ): Promise<{ plateletCount: number }> {
    let plateletCount = 0;
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);

    // Use real-time find with plateId - no intermediate data structures
    for await (const [
      currentPlateletId,
      currentPlatelet,
    ] of plateletsCollection.find('plateId', plateId)) {
      plateletCount++;

      // Perform gap-filling for this platelet
      await this.validUnrealizedPlateletNeighbors(currentPlatelet, plate);
    }

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
  }

  /**
   * Create irregular edges for larger plates by deleting edge platelets
   */
  async createIrregularPlateEdges(): Promise<void> {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    let startingCount = await plateletsCollection.count();
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }

    // Refresh neighbor relationships BEFORE edge detection to ensure accurate neighbor counts
    await this.refreshNeighbors();

    let totalDeleted = 0;

    // Process each plate individually in random order
    const planet = await this.planet();

    const plates = this.simUniv.get(COLLECTIONS.PLATES);
    for await (const [plateId, plate] of plates.find('planetId', planet.id)) {
      if (plate.simId !== this.simulationId) {
        continue;
      }

      await this.createIrregularEdgesForPlate(plateId, plate);
    }
  }

  /**
   * Create irregular edges for a specific plate
   */
  private async createIrregularEdgesForPlate(
    plateId: string,
    plate: PlateIF,
  ): Promise<number> {
    const plateletsCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }
    const platelets = await this.simUniv
      .get(COLLECTIONS.PLATELETS)
      .find('plateId', plateId);

    const edgePlateletIDs: string[] = [];
    let plateSize = 0;
    for await (const [id, platelet] of platelets) {
      plateSize += 1;
      if (platelet.neighborCellIds.length < 6) {
        edgePlateletIDs.push(id);
      }
    }

    // Shuffle the edge platelets for random selection
    const allPlateletsToDelete = new Set<string>();

    // Calculate maximum allowed deletions (25% of total plate size for much better visualization)
    const maxAllowedDeletions = Math.max(
      2,
      Math.floor(edgePlateletIDs.length * 0.25),
    );

    if (plateSize >= 40) {
      // For large plates (40+ platelets): Use cascading deletion only (no initial edge accretion)
      const deleteCount = Math.min(
        Math.max(2, Math.floor(edgePlateletIDs.length * 0.2)), // Reduced to 20% of edge platelets
        maxAllowedDeletions,
      );
      const idsToDelete = shuffle(edgePlateletIDs).slice(0, deleteCount);

      // For each selected edge platelet, apply cascading deletion to neighbors
      for (const id of idsToDelete) {
        await this.limitedDeleteNeighbors(
          id,
          allPlateletsToDelete,
          varyP({ min: 2, max: 8 }),
        );
      }
    } else {
      // For medium plates (30-39 platelets): Use edge accretion only
      const deleteCount = Math.min(
        Math.max(2, Math.floor(edgePlateletIDs.length * 0.4)), // Reduced to 40% of edge platelets
        maxAllowedDeletions,
      );
      const plateletIDsToDelete = shuffle(edgePlateletIDs).slice(
        0,
        deleteCount,
      );

      plateletIDsToDelete.forEach((id) => {
        allPlateletsToDelete.add(id);
      });
    }

    // Island detection: Remove edge platelets that have no non-destroyed neighbors
    /*    const islandPlatelets = this.findIslandPlatelets(
          platelets,
          allPlateletsToDelete,
        );

        // Add island platelets to deletion set
        islandPlatelets.forEach((plateletId) => {
          allPlateletsToDelete.add(plateletId);
        });*/

    await Promise.all(
      Array.from(allPlateletsToDelete.values()).map(async (id) => {
        // prepare to delete the platelet
        const platelet = await plateletsCollection.get(id);
        if (!platelet) {
          return;
        }
        const { neighborCellIds } = platelet as PlateletIF;

        // remove the deleted ids from each neighbor of the deleted cell;
        await Promise.all(
          neighborCellIds.map(async (id) => {
            try {
              await plateletsCollection.mutate(id, (nPlatelet: PlateletIF) => {
                if (!nPlatelet) {
                  return;
                }
                const { neighborCellIds } = nPlatelet as PlateletIF;
                if (!Array.isArray(neighborCellIds)) {
                  return nPlatelet;
                }
                const newNeighbors = neighborCellIds.filter(
                  (nCell) => !allPlateletsToDelete.has(nCell),
                );
                nPlatelet.neighborCellIds = newNeighbors;
                return nPlatelet;
              });
            } catch (err) {
              console.error('error in deleting neighbors:', err);
            }
          }),
        );
      }),
    );

    await plateletsCollection.deleteMany(Array.from(allPlateletsToDelete));
    return allPlateletsToDelete.size;
  }

  private async getPlateletFor(cell: string, plateId: string) {
    if (!(cell && plateId)) {
      return [];
    }

    const plateletCollection = this.simUniv.get(COLLECTIONS.PLATELETS);

    const candidates = await plateletCollection.find('h3Cell', cell);
    const list = await asyncIterToMap(candidates);
    return Array.from(list.values()).filter(
      (platelet: PlateletIF) => platelet.plateId === plateId,
    );
  }

  /**
   * Limited deletion of neighbors with hard cap on total deletions
   */
  private async limitedDeleteNeighbors(
    plateletId: string,
    deletedSet: Set<string>,
    deletions: number,
  ) {
    let startingDeletions = deletions;
    let plateId;
    while (deletions > 0 && plateletId) {
      // Add this platelet to deletion set
      deletedSet.add(plateletId);

      const plateletCollection = this.simUniv.get(COLLECTIONS.PLATELETS);
      const platelet = (await plateletCollection.get(plateletId)) as PlateletIF;
      if (!plateId) {
        plateId = platelet.plateId;
      }
      if (!platelet) {
        console.warn('cannot get platelet', plateletId);
        return;
      }
      if (!Array.isArray(platelet?.neighborCellIds)) {
        console.warn('no neighbor cell ids', platelet);
        break;
      }

      let cells = [...platelet?.neighborCellIds];

      const neighbors = await Promise.all(
        cells.map((cell) => this.getPlateletFor(cell, plateId)),
      );

      const deleteable = neighbors
        .flat()
        .filter((platelet) => !deletedSet.has(platelet.id))
        .map((p) => p.id);

      plateletId = shuffle(deleteable).pop();
      deletions -= 1;
    }
  }

  /**
   * Complete platelet workflow: populate neighbors and create irregular edges
   * This should be called after all platelets have been generated for all plates
   * to ensure proper neighbor relationships and realistic plate boundaries
   */
  async completePlateletWorkflow(): Promise<void> {
    console.log('🔗 Starting complete platelet workflow...');
    console.time('⏱️ Complete Platelet Workflow');

    // Step 1: Populate neighbor relationships between all platelets
    console.log('  📊 Populating platelet neighbor relationships...');
    console.time('  ⏱️ Neighbor Population');
    await this.populatePlateletNeighbors();
    console.timeEnd('  ⏱️ Neighbor Population');

    // Step 2: Create irregular plate edges by removing edge platelets
    console.log('  ✂️ Creating irregular plate edges...');
    console.time('  ⏱️ Edge Creation');
    await this.createIrregularPlateEdges();
    console.timeEnd('  ⏱️ Edge Creation');

    console.timeEnd('⏱️ Complete Platelet Workflow');
    console.log('✅ Platelet workflow completed successfully');
  }
}
