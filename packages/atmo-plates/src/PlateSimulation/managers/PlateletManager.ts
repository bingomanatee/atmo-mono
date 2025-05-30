import {
  cellToVector,
  h3HexRadiusAtResolution,
} from '@wonderlandlabs/atmo-utils';
import { Vector3 } from 'three';
import { COLLECTIONS } from '../constants';
import { Platelet } from '../schemas/platelet';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import { getH0CellForPosition } from '../utils/plateletUtils';

export class PlateletManager {
  public static readonly PLATELET_CELL_LEVEL = 3; // Resolution level for platelets (higher resolution, smaller platelets)
  public static readonly MAX_PLATELETS_PER_PLATE = 1000; // Maximum platelets per plate to prevent performance issues

  private sim: PlateSimulationIF;

  constructor(sim: PlateSimulationIF) {
    this.sim = sim;
  }

  async generatePlatelets(plateId: string): Promise<Platelet[]> {
    // Get the plate data
    const plate = await this.sim.getPlate(plateId);
    if (!plate) {
      console.warn(
        `Plate ${plateId} not found in simulation. Cannot generate platelets.`,
      );
      return [];
    }

    // Get planet radius
    const planet = await this.sim.getPlanet(plate.planetId);
    if (!planet)
      throw new Error(`Planet ${plate.planetId} not found in simulation`);
    const planetRadius = planet.radius;

    console.log(`🌍 PLATELET GENERATION DEBUG:`);
    console.log(`   sim.planetRadius: ${this.sim.planetRadius}km`);
    console.log(`   planet.radius: ${planetRadius}km`);
    console.log(`   plate.radius: ${plate.radius}km`);

    // Check H3 cell radius calculation
    const h3CellRadius = h3HexRadiusAtResolution(
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
    );
    console.log(
      `   h3CellRadius at resolution ${PlateletManager.PLATELET_CELL_LEVEL}: ${h3CellRadius}km
      
      `,
    );

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

    // Use parallel H0 cell processing for better performance
    const generatedPlatelets = await this.processH0CellsInParallel(
      plateCenterH0Cell,
      plate,
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
    );

    // Batch write all platelets to collection for better performance
    const batchWrites = generatedPlatelets.map((platelet) =>
      plateletsCollection.set(platelet.id, platelet),
    );
    await Promise.all(batchWrites);

    // Apply intelligent limiting based on plate size
    const limitedPlatelets = this.limitPlateletsByPlateSize(
      generatedPlatelets,
      plate,
    );

    // If we had to limit, remove excess platelets from the collection
    if (limitedPlatelets.length < generatedPlatelets.length) {
      const excessCount = generatedPlatelets.length - limitedPlatelets.length;
      console.warn(
        `⚠️ Plate ${plateId} has ${generatedPlatelets.length} platelets but buffer only supports ${limitedPlatelets.length}. Truncating ${excessCount} platelets.`,
      );

      // Remove excess platelets from collection
      const excessPlatelets = generatedPlatelets.slice(limitedPlatelets.length);
      for (const platelet of excessPlatelets) {
        await plateletsCollection.delete(platelet.id);
      }
    }

    return limitedPlatelets;
  }

  /**
   * Intelligently limit platelets based on plate size to prevent performance issues
   */
  private limitPlateletsByPlateSize(
    platelets: Platelet[],
    plate: any,
  ): Platelet[] {
    const plateRadiusKm = plate.radius; // plate.radius is already in km
    const earthRadiusKm = 6371; // Earth radius in km

    console.log(
      `🔍 Plate ${plate.id}: radius=${plateRadiusKm}km, ${platelets.length} platelets generated`,
    );

    // Calculate plate size relative to Earth
    const plateToEarthRatio = plateRadiusKm / earthRadiusKm;

    // Dynamic limit based on plate size
    let maxPlatelets: number;

    if (plateToEarthRatio > 0.5) {
      // Very large plates (> 50% of Earth radius) - severely limit
      maxPlatelets = 50;
    } else if (plateToEarthRatio > 0.3) {
      // Large plates (30-50% of Earth radius) - moderate limit
      maxPlatelets = 200;
    } else if (plateToEarthRatio > 0.15) {
      // Medium plates (15-30% of Earth radius) - higher limit
      maxPlatelets = 500;
    } else {
      // Small plates (< 15% of Earth radius) - use full limit
      maxPlatelets = PlateletManager.MAX_PLATELETS_PER_PLATE;
    }

    // Apply the limit
    if (platelets.length > maxPlatelets) {
      // Sort by some criteria (e.g., distance from plate center) and take the best ones
      // For now, just take the first N platelets
      return platelets.slice(0, maxPlatelets);
    }

    return platelets;
  }

  /**
   * Process H0 cells in parallel for much faster platelet generation
   */
  private async processH0CellsInParallel(
    startH0Cell: string,
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<Platelet[]> {
    const processedH0Cells = new Set<string>();
    const allPlatelets: Platelet[] = [];
    const cellQueue = [startH0Cell];

    console.log(`🚀 ------------------------------
     Starting parallel H0 processing for plate ${plate.id}
     with h0 cell ${startH0Cell} -- (${cellToVector(startH0Cell, planetRadius).round().toArray().join(', ')})
     from plate position ${new Vector3().copy(plate.position).round().toArray().join(', ')})
    `);

    while (cellQueue.length > 0) {
      // Process up to 8 H0 cells in parallel (good balance for most systems)
      const currentBatch = cellQueue.splice(0, 8);
      const batchPromises = currentBatch.map(async (h0Cell) => {
        if (processedH0Cells.has(h0Cell))
          return { platelets: [], newCells: [] };
        processedH0Cells.add(h0Cell);

        return await this.processH0CellParallel(
          h0Cell,
          plate,
          planetRadius,
          resolution,
        );
      });

      const batchResults = await Promise.all(batchPromises);

      // Collect results and new cells to process
      for (const result of batchResults) {
        allPlatelets.push(...result.platelets);

        // Add new neighboring cells to queue if they have platelets
        for (const newCell of result.newCells) {
          if (!processedH0Cells.has(newCell) && !cellQueue.includes(newCell)) {
            cellQueue.push(newCell);
          }
        }
      }
    }

    console.log(
      `✅ Parallel processing complete: ${allPlatelets.length} platelets for plate ${plate.id}`,
    );
    return allPlatelets;
  }

  /**
   * Process a single H0 cell and return platelets + neighboring cells to explore
   */
  private async processH0CellParallel(
    h0Cell: string,
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<{ platelets: Platelet[]; newCells: string[] }> {
    const {
      getCellsInH0Cell,
      filterCellsByPlateRadius,
      createPlateletFromCell,
      getNeighboringH0Cells,
    } = await import('../utils/plateletUtils');

    // Get all cells at the specified resolution within this H0 cell
    const plateletCells = getCellsInH0Cell(h0Cell, resolution);

    // Filter cells within radius of the plate
    const validPlateletCells = filterCellsByPlateRadius(
      plateletCells,
      plate,
      planetRadius,
    );

    // If no valid platelets, don't explore neighbors
    if (validPlateletCells.length === 0) {
      return { platelets: [], newCells: [] };
    }

    // Create platelets in parallel
    const plateletPromises = validPlateletCells.map((cell) =>
      Promise.resolve(
        createPlateletFromCell(cell, plate, planetRadius, resolution),
      ),
    );
    const platelets = await Promise.all(plateletPromises);

    // Get neighboring H0 cells to explore next
    const neighborH0Cells = getNeighboringH0Cells(h0Cell);

    return { platelets, newCells: neighborH0Cells };
  }

  /**
   * Add a platelet to the simulation's platelet collection, with validation.
   */
  async setPlatelet(platelet: Platelet | null | undefined): Promise<void> {
    if (!platelet || typeof platelet !== 'object') {
      throw new Error('Attempted to add an empty or invalid platelet');
    }
    const plateletsCollection = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) throw new Error('platelets collection not found');
    await plateletsCollection.set(platelet.id, platelet);
  }
}
