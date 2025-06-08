import { Vector3 } from 'three';
import { isValidCell, latLngToCell } from 'h3-js';
import {
  cellToVector,
  getCellsInRange, getNeighborsAsync,
  h3HexRadiusAtResolution,
  pointToLatLon
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

  async generatePlatelets(plateId: string): Promise<Platelet[]> {
    // Get the plates collection
    const platesCollection = this.universe.get(COLLECTIONS.PLATES);
    if (!platesCollection) {
      throw new Error('plates collection not found');
    }

    // Get the plate data
    const plate: SimPlateIF = await platesCollection.get(plateId);
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

    // Get the platelets collection
    const plateletsCollection = this.universe.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) {
      throw new Error('platelets collection not found');
    }

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

    const platelets: Platelet[] = [];

    if (validCells.length === 0) {
      const centerPlatelet = await this.createSimplePlatelet(
        `${plate.id}-center`,
        plate,
        new Vector3().copy(plate.position),
        centralCell,
        planetRadius
      );
      platelets.push(centerPlatelet);
    } else {
      let successCount = 0;
      let failureCount = 0;

      for (const cell of validCells) {
        try {
          const cellPosition = cellToVector(cell, planetRadius);
          if (cellPosition) {
            const platelet = await this.createSimplePlatelet(
              `${plate.id}-${cell}`,
              plate,
              cellPosition,
              cell,
              planetRadius
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
  private async createSimplePlatelet(
    id: string,
    plate: SimPlateIF,
    position: Vector3,
    h3Cell: string,
    planetRadius,
  ): Promise<PlateletIF> {

    const neighborCellIds = h3Cell ? await getNeighborsAsync(h3Cell) : []

    return {
      id,
      plateId: plate.id,
      planetId: plate.planetId,
      position: new Vector3().copy(position),
      h3Cell,
      radius: h3HexRadiusAtResolution(planetRadius, PlateletManager.PLATELET_CELL_LEVEL),
      thickness: plate.thickness,
      density: plate.density,
      elasticity: 0.3,
      neighborCellIds
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
