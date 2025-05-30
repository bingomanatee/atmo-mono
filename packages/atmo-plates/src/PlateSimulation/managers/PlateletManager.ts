import {
  cellToVector,
  getCellsInRange,
  h3HexRadiusAtResolution,
  isValidCell,
  latLngToCell,
  pointToLatLon,
} from '@wonderlandlabs/atmo-utils';
import { Vector3 } from 'three';
import { log } from '../../utils/utils';
import { COLLECTIONS } from '../constants';
import { Platelet } from '../schemas/platelet';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import {
  createCenterPlatelet,
  createPlateletFromCell,
  filterCellsByPlateRadius,
  getCellsInH0Cell,
  getH0CellForPosition,
  getNeighboringH0Cells,
} from '../utils/plateletUtils';

export class PlateletManager {
  public static readonly PLATELET_CELL_LEVEL = 3; // Resolution level for platelets (higher resolution, smaller platelets)

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

    log(`🌍 PLATELET GENERATION DEBUG:
      sim.planetRadius: ${this.sim.planetRadius}km
      planet.radius: ${planetRadius}km
      plate.radius: ${plate.radius}km`);

    // Check H3 cell radius calculation
    const h3CellRadius = h3HexRadiusAtResolution(
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
    );
    log(
      `   h3CellRadius at resolution ${PlateletManager.PLATELET_CELL_LEVEL}: ${h3CellRadius}km`,
    );

    // Get the platelets collection from the simulation
    const plateletsCollection = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) throw new Error('platelets collection not found');

    // Use the new gridDisk-based approach for better performance
    const generatedPlatelets = await this.generatePlateletsWithGridDisk(
      plate,
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
    );

    // Batch write all platelets to collection for better performance
    const batchWrites = generatedPlatelets.map((platelet) =>
      plateletsCollection.set(platelet.id, platelet),
    );
    await Promise.all(batchWrites);

    log(
      `✅ Generated ${generatedPlatelets.length} platelets for plate ${plateId}`,
    );

    return generatedPlatelets;
  }

  /**
   * Generate platelets using gridDisk expansion from plate center - much faster and simpler!
   */
  private async generatePlateletsWithGridDisk(
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<Platelet[]> {
    log(`🎯 Using gridDisk method for plate ${plate.id}`);

    // Get the central H3 cell for the plate position
    const platePosition = new Vector3().copy(plate.position);
    const { lat, lon } = pointToLatLon(platePosition, planetRadius);
    const centralCell = latLngToCell(lat, lon, resolution);

    log(`   Central H3 cell: ${centralCell}`);
    log(`   Plate radius: ${plate.radius}km`);

    // Calculate how many H3 cell radii we need to cover the plate
    const h3CellRadius = h3HexRadiusAtResolution(planetRadius, resolution);
    log(`   H3 cell radius at resolution ${resolution}: ${h3CellRadius}km`);

    // Use 133% of plate radius to account for hexagonal geometry
    const searchRadius = plate.radius * 1.33;

    // Calculate how many H3 cell "rings" we need to cover the search radius
    // Each ring is approximately one H3 cell radius away from the previous ring
    const ringsNeeded = Math.ceil(searchRadius / h3CellRadius);

    // Cap the rings to prevent performance issues - gridDisk grows exponentially
    // Each ring adds ~6*ring cells, so 20 rings = ~1260 cells
    const gridDiskRings = Math.min(ringsNeeded, 20);

    log(`   Search radius (133% of plate): ${searchRadius.toFixed(2)}km`);
    log(`   Rings needed: ${ringsNeeded}, capped to: ${gridDiskRings} rings`);

    // Get all cells within the gridDisk rings using atmo-utils helper
    const candidateCells = getCellsInRange(centralCell, gridDiskRings);
    log(`   Found ${candidateCells.length} candidate cells`);

    // Filter cells that are actually within the plate radius
    const validCells: string[] = [];
    const plateCenter = platePosition;
    let invalidCellCount = 0;
    let outOfRangeCount = 0;

    for (const cell of candidateCells) {
      // First check if the H3 cell is valid
      if (!isValidCell(cell)) {
        invalidCellCount++;
        continue;
      }

      try {
        const cellPosition = cellToVector(cell, planetRadius);
        if (!cellPosition) {
          invalidCellCount++;
          continue;
        }

        const distanceToPlate = cellPosition.distanceTo(plateCenter);

        if (distanceToPlate <= plate.radius) {
          validCells.push(cell);
        } else {
          outOfRangeCount++;
        }
      } catch (error) {
        invalidCellCount++;
      }
    }

    log(
      `   Filtering results: ${validCells.length} valid, ${outOfRangeCount} out of range, ${invalidCellCount} invalid cells`,
    );

    log(`   Filtered to ${validCells.length} valid cells within plate radius`);

    // Create platelets for all valid cells
    const platelets: Platelet[] = [];

    if (validCells.length === 0) {
      // Fallback: create center platelet if no valid cells found
      log(`   No valid cells found, creating center platelet fallback`);
      const centerPlatelet = createCenterPlatelet(
        plate,
        planetRadius,
        resolution,
      );
      platelets.push(centerPlatelet);
    } else {
      // Create platelets for all valid cells
      let successCount = 0;
      let failureCount = 0;

      for (const cell of validCells) {
        try {
          const platelet = createPlateletFromCell(
            cell,
            plate,
            planetRadius,
            resolution,
          );
          if (platelet && platelet.position) {
            platelets.push(platelet);
            successCount++;
          } else {
            log(
              `   Warning: Platelet creation failed for cell ${cell} - position is undefined`,
            );
            failureCount++;
          }
        } catch (error) {
          log(`   Warning: Error creating platelet for cell ${cell}: ${error}`);
          failureCount++;
        }
      }

      log(
        `   Platelet creation: ${successCount} successful, ${failureCount} failed`,
      );
    }

    log(`   ✅ Created ${platelets.length} platelets using gridDisk method`);

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

    log(`🚀 ------------------------------
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

    log(
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
}
