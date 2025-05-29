import { Vector3 } from 'three';
import { COLLECTIONS } from '../constants';
import { Platelet } from '../schemas/platelet';
import type { PlateSimulationIF } from '../types.PlateSimulation';
import { getH0CellForPosition, processH0Cell } from '../utils/plateletUtils';

export class PlateletManager {
  public static readonly PLATELET_CELL_LEVEL = 3; // Resolution level for platelets

  private sim: PlateSimulationIF;

  constructor(sim: PlateSimulationIF) {
    this.sim = sim;
  }

  generatePlatelets(plateId: string): Platelet[] {
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

    // Get the platelets collection from the simulation
    const plateletsCollection = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) throw new Error('platelets collection not found');

    // Get the H0 cell for the plate's position
    const platePosition = new Vector3(
      plate.position.x,
      plate.position.y,
      plate.position.z,
    );
    const plateCenterH0Cell = getH0CellForPosition(platePosition, planetRadius);

    // Process the plate's H0 cell and its neighbors, adding platelets directly to the collection
    processH0Cell(
      plateCenterH0Cell,
      plate,
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
      processedH0Cells,
      plateletsCollection, // Pass collection
    );

    // Return the generated platelets by filtering the collection
    const generatedPlatelets: Platelet[] = [];
    plateletsCollection.each((platelet: Platelet) => {
      if (platelet.plateId === plateId) {
        generatedPlatelets.push(platelet);
      }
    });

    return generatedPlatelets;
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
