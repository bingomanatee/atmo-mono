import { Vector3 } from 'three';
import { latLngToCell, isValidCell } from 'h3-js';
import {
  pointToLatLon,
  cellToVector,
  getCellsInRange,
  h3HexRadiusAtResolution,
} from '@wonderlandlabs/atmo-utils';
import { Universe } from '@wonderlandlabs/multiverse';

import { COLLECTIONS } from '../constants';

const log = console.log;

// Simple types for the core PlateletManager
interface Plate {
  id: string;
  planetId: string;
  position: { x: number; y: number; z: number };
  radius: number;
}

interface Platelet {
  id: string;
  plateId: string;
  planetId: string;
  position: { x: number; y: number; z: number };
  h3Cell: string;
  radius: number;
  thickness: number;
  density: number;
  mass: number;
  elasticity: number;
}

/**
 * Core PlateletManager - Pure business logic, no worker awareness
 * Takes a universe instance and operates on it directly
 * Can be instantiated in any context (main thread, worker, tests)
 */
export class PlateletManager {
  static readonly PLATELET_CELL_LEVEL = 3;

  private universe: Universe;

  constructor(universe: Universe) {
    this.universe = universe;
    log('🔧 PlateletManager initialized (core version - universe injected)');
  }

  async generatePlatelets(plateId: string): Promise<Platelet[]> {
    // Get the plates collection
    const platesCollection = this.universe.get(COLLECTIONS.PLATES);
    if (!platesCollection) throw new Error('plates collection not found');

    // Get the plate data
    const plate = await platesCollection.get(plateId);
    if (!plate) {
      console.warn(`Plate ${plateId} not found. Cannot generate platelets.`);
      return [];
    }

    // Get the planets collection
    const planetsCollection = this.universe.get(COLLECTIONS.PLANETS);
    if (!planetsCollection) throw new Error('planets collection not found');

    // Get planet radius
    const planet = await planetsCollection.get(plate.planetId);
    if (!planet) throw new Error(`Planet ${plate.planetId} not found`);
    const planetRadius = planet.radius;

    // Check H3 cell radius calculation (for validation)
    h3HexRadiusAtResolution(planetRadius, PlateletManager.PLATELET_CELL_LEVEL);

    // Get the platelets collection
    const plateletsCollection = this.universe.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) throw new Error('platelets collection not found');

    // Generate platelets using main thread (core version)
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

    return generatedPlatelets;
  }

  /**
   * Generate platelets for multiple plates sequentially (core version)
   */
  async generatePlateletsForMultiplePlates(
    plateIds: string[],
  ): Promise<Map<string, Platelet[]>> {
    return this.generatePlateletsSequentially(plateIds);
  }

  /**
   * Sequential platelet generation method
   */
  private async generatePlateletsSequentially(
    plateIds: string[],
  ): Promise<Map<string, Platelet[]>> {
    const plateletsByPlate = new Map<string, Platelet[]>();

    for (const plateId of plateIds) {
      const platelets = await this.generatePlatelets(plateId);
      plateletsByPlate.set(plateId, platelets);
    }

    return plateletsByPlate;
  }

  /**
   * Generate platelets using gridDisk expansion from plate center - much faster and simpler!
   */
  private async generatePlateletsWithGridDisk(
    plate: Plate,
    planetRadius: number,
    resolution: number,
  ): Promise<Platelet[]> {
    // Get the central H3 cell for the plate position
    const platePosition = new Vector3().copy(plate.position);
    const { lat, lon } = pointToLatLon(platePosition, planetRadius);
    const centralCell = latLngToCell(lat, lon, resolution);

    // Smart unit detection for plate radius
    let plateRadiusKm = plate.radius;

    // Calculate how many H3 cell radii we need to cover the plate
    const h3CellRadius = h3HexRadiusAtResolution(planetRadius, resolution);

    // Use 133% of plate radius to account for hexagonal geometry
    const searchRadius = plateRadiusKm * 1.33;

    // Calculate how many H3 cell "rings" we need to cover the search radius
    // Each ring is approximately one H3 cell radius away from the previous ring
    const ringsNeeded = Math.ceil(searchRadius / h3CellRadius);

    // SAFETY CHECK: Cap the rings to prevent H3 overflow
    const maxSafeRings = 50; // H3 gridDisk can handle up to ~50 rings safely
    const gridDiskRings = Math.min(ringsNeeded, maxSafeRings);

    // Get all cells within the gridDisk rings using atmo-utils helper
    const candidateCells = getCellsInRange(centralCell, gridDiskRings);

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

        if (distanceToPlate <= plateRadiusKm) {
          validCells.push(cell);
        } else {
          outOfRangeCount++;
        }
      } catch (error) {
        invalidCellCount++;
      }
    }

    // Create platelets for all valid cells
    const platelets: Platelet[] = [];

    if (validCells.length === 0) {
      // Fallback: create center platelet if no valid cells found
      const centerPlatelet = this.createSimplePlatelet(
        `${plate.id}-center`,
        plate,
        new Vector3().copy(plate.position),
        centralCell,
      );
      platelets.push(centerPlatelet);
    } else {
      // Create platelets for all valid cells
      let successCount = 0;
      let failureCount = 0;

      for (const cell of validCells) {
        try {
          const cellPosition = cellToVector(cell, planetRadius);
          if (cellPosition) {
            const platelet = this.createSimplePlatelet(
              `${plate.id}-${cell}`,
              plate,
              cellPosition,
              cell,
            );
            platelets.push(platelet);
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }
    }

    return platelets;
  }

  /**
   * Create a simple platelet for the core version
   */
  private createSimplePlatelet(
    id: string,
    plate: Plate,
    position: Vector3,
    h3Cell: string,
  ): Platelet {
    return {
      id,
      plateId: plate.id,
      planetId: plate.planetId,
      position: { x: position.x, y: position.y, z: position.z },
      h3Cell,
      radius: 1000, // Default 1km radius
      thickness: 100, // Default 100m thickness
      density: 2700, // Default rock density kg/m³
      mass: 0, // Will be calculated
      elasticity: 0.3, // Default elasticity
    };
  }

  /**
   * Get status for monitoring
   */
  getStatus() {
    return {
      type: 'injectable-manager',
      dataSource: 'IDBSun-IndexedDB',
      universeId: this.universe.name || 'default-universe',
      stateless: true,
    };
  }

  /**
   * Clean up resources when the manager is destroyed
   */
  cleanup(): void {
    log('🧹 PlateletManager: Cleaning up resources (core version)');
    log('✅ PlateletManager: Cleanup completed');
  }
}
