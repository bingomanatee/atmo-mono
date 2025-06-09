import { Vector3 } from 'three';
import { isValidCell, latLngToCell } from 'h3-js';
import {
  cellToVector,
  getCellsInRange,
  getNeighborsAsync,
  h3HexRadiusAtResolution,
  pointToLatLon,
} from '@wonderlandlabs/atmo-utils';
import { Universe } from '@wonderlandlabs/multiverse';

import { COLLECTIONS } from '../constants';
import { PlateletIF, SimPlateIF } from '../types.PlateSimulation';

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

  get platesCollection() {
    return this.universe.get(COLLECTIONS.PLATES);
  }

  get plateletsCollection() {
    return this.universe.get(COLLECTIONS.PLATELETS);
  }

  async generatePlatelets(plateId: string): Promise<void> {
    // Get the plate data
    const plate: SimPlateIF = await this.platesCollection.get(plateId);
    if (!plate) {
      console.warn(`Plate ${plateId} not found. Cannot generate platelets.`);
      return [];
    }

    // Get the planets collection
    const planetsCollection = this.universe.get(COLLECTIONS.PLANETS);
    if (!planetsCollection) {
      throw new Error('planets collection not found');
    }

    // Get planet radius
    const planet = await planetsCollection.get(plate.planetId);
    if (!planet) {
      throw new Error(`Planet ${plate.planetId} not found`);
    }
    const planetRadius = planet.radius;

    // Check H3 cell radius calculation (for validation)
    h3HexRadiusAtResolution(planetRadius, PlateletManager.PLATELET_CELL_LEVEL);

    // Generate platelets and write directly to collection
    const plateletCount = await this.generatePlateletsWithGridDisk(
      plate,
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
    );

    console.log('----- generated ', plateletCount, 'platelets --------');
  }

  static plateletId(plateId: string, h3Cell: string) {
    return `${plateId}-${h3Cell}`;
  }

  /**
   * Generate platelets using gridDisk expansion from plate center - writes directly to collection!
   */
  private async generatePlateletsWithGridDisk(
    plate: Plate,
    planetRadius: number,
    resolution: number,
  ): Promise<number> {
    // Get the central H3 cell for the plate position
    const platePosition = new Vector3().copy(plate.position);
    const { lat, lon } = pointToLatLon(platePosition, planetRadius);
    const centralCell = latLngToCell(lat, lon, resolution);

    let plateRadiusKm = plate.radius;

    const h3CellRadius = h3HexRadiusAtResolution(planetRadius, resolution);

    const searchRadius = plateRadiusKm * 1.33;

    const ringsNeeded = Math.ceil(searchRadius / h3CellRadius);

    const maxSafeRings = 50;
    const gridDiskRings = Math.min(ringsNeeded, maxSafeRings);

    const candidateCells = getCellsInRange(centralCell, gridDiskRings);

    const validCells: string[] = [];
    const plateCenter = platePosition;
    let invalidCellCount = 0;
    let outOfRangeCount = 0;

    for (const cell of candidateCells) {
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

    if (validCells.length === 0) {
      // Handle single center platelet case
      const centerPlatelet = await this.createSimplePlatelet(
        `${plate.id}-center`,
        plate,
        new Vector3().copy(plate.position),
        centralCell,
        planetRadius,
      );
      // Write directly to collection
      await this.plateletsCollection.set(centerPlatelet.id, centerPlatelet);
      return 1;
    } else {
      let count = 0;
      // Create all platelets in parallel
      const plateletPromises = validCells.map(async (cell) => {
        try {
          const cellPosition = cellToVector(cell, planetRadius);
          if (cellPosition) {
            const platelet = await this.createSimplePlatelet(
              PlateletManager.plateletId(plate.id, cell),
              plate,
              cellPosition,
              cell,
              planetRadius,
            );
            await this.plateletsCollection.set(platelet.id, platelet);
            count += 1;
            return platelet;
          }
          return null;
        } catch (error) {
          return null;
        }
      });
      await Promise.all(plateletPromises);
      return count;
    }
  }

  /**
   * Create a simple platelet for the core version
   */
  private async createSimplePlatelet(
    id: string,
    plate: any, // Accept any plate type
    position: Vector3,
    h3Cell: string,
    planetRadius: number,
  ): Promise<PlateletIF> {
    const neighborCellIds = h3Cell ? await getNeighborsAsync(h3Cell) : [];

    return {
      id,
      plateId: plate.id,
      planetId: plate.planetId,
      position: new Vector3().copy(position),
      h3Cell,
      sector: '', // Add empty sector for now
      radius: h3HexRadiusAtResolution(
        planetRadius,
        PlateletManager.PLATELET_CELL_LEVEL,
      ),
      thickness: plate.thickness,
      density: plate.density,
      neighborCellIds,
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
