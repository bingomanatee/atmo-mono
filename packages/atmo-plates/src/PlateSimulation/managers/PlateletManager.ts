import { Vector3 } from 'three';
import { Platelet } from '../schemas/platelet';
import type { PlateSimulationIF } from '../types.PlateSimulation';
import { COLLECTIONS } from '../constants';
import { getH0CellForPosition, processH0Cell } from '../utils/plateletUtils';

export class PlateletManager {
  private static plateletCache: Map<string, Platelet[]> = new Map();
  private static readonly PLATELET_CELL_LEVEL = 3; // Resolution level for platelets

  private sim: PlateSimulationIF;

  constructor(sim: PlateSimulationIF) {
    this.sim = sim;
  }

  generatePlatelets(plateId: string): Platelet[] {
    // Check cache first
    const cached = PlateletManager.plateletCache.get(plateId);
    if (cached) {
      return cached;
    }

    // Get the plate data
    const plate = this.sim.getPlate(plateId);
    if (!plate) {
      console.warn(
        `Plate ${plateId} not found in simulation. Cannot generate platelets.`,
      );
      return [];
    }

    // Get planet radius
    const planet = this.sim.getPlanet(plate.planetId);
    if (!planet)
      throw new Error(`Planet ${plate.planetId} not found in simulation`);
    const planetRadius = planet.radius;

    // Initialize data structures for platelet generation
    const processedH0Cells = new Set<string>();
    const platelets: Platelet[] = [];
    const plateletIds: string[] = [];
    const index = { value: 0 };

    // Get the H0 cell for the plate's position
    const platePosition = new Vector3(
      plate.position.x,
      plate.position.y,
      plate.position.z,
    );
    const plateCenterH0Cell = getH0CellForPosition(platePosition, planetRadius);

    // Process the plate's H0 cell and its neighbors
    processH0Cell(
      plateCenterH0Cell,
      plate,
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
      processedH0Cells,
      platelets,
      plateletIds,
      index,
    );

    // Update the plate with the generated platelet IDs
    const platesCollection = this.sim.simUniv.get(COLLECTIONS.PLATES);
    if (!platesCollection) throw new Error('plates collection not found');
    const latestPlate = platesCollection.get(plate.id);
    if (!latestPlate)
      throw new Error(
        `Plate ${plate.id} not found in collection after generation setup`,
      );
    platesCollection.set(plate.id, { ...latestPlate, plateletIds });

    // Cache the result
    PlateletManager.plateletCache.set(plate.id, platelets);
    return platelets;
  }

  getCachedPlatelets(plateId: string): Platelet[] | undefined {
    return PlateletManager.plateletCache.get(plateId);
  }

  clearCache(plateId?: string) {
    if (plateId) {
      PlateletManager.plateletCache.delete(plateId);
    } else {
      PlateletManager.plateletCache.clear();
    }
  }

  /**
   * Add a platelet to the simulation's platelet collection, with validation.
   */
  setPlatelet(platelet: Platelet | null | undefined): void {
    if (!platelet || typeof platelet !== 'object') {
      throw new Error('Attempted to add an empty or invalid platelet');
    }
    const plateletsCollection = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) throw new Error('platelets collection not found');
    plateletsCollection.set(platelet.id, platelet);
  }
}
