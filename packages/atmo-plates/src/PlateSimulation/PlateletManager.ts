import { Vector3 } from 'three';
import { Plate } from './PlateSimulation';
import { Platelet } from './schemas/platelet';
import {
  cellToVector,
  latLngToCell,
  cellToChildren,
  h3HexRadiusAtResolution,
  geoToH3,
  EARTH_RADIUS,
} from '@wonderlandlabs/atmo-utils';
import * as h3 from 'h3-js';

export class PlateletManager {
  private plateletCache: Map<string, Platelet[]>;
  private allH4CellsCache: string[]; // Cache for all resolution 4 H3 cells

  constructor() {
    this.plateletCache = new Map();
    this.allH4CellsCache = this.generateAllH4Cells(); // Populate the cache
  }

  private generateAllH4Cells(): string[] {
    const allCells: string[] = [];
    const res0Cells = h3.getRes0Cells();
    const resolution = 4;

    res0Cells.forEach((res0Cell) => {
      const children = cellToChildren(res0Cell, resolution);
      allCells.push(...children);
    });

    return allCells;
  }

  generatePlatelets(plate: Plate): Platelet[] {
    // Check cache first
    const cached = this.plateletCache.get(plate.id);
    if (cached) {
      return cached;
    }

    // Generate platelets by filtering all H4 cells by distance to plate center
    const platelets: Platelet[] = [];
    const resolution = 4; // Level 4 gives us ~100km cells

    let index = 0;
    this.allH4CellsCache.forEach((cell) => {
      // Position the platelet on the Earth's surface using EARTH_RADIUS
      const position = cellToVector(cell, EARTH_RADIUS);

      // Only include platelets within the plate's radius
      if (position.distanceTo(plate.position) <= plate.radius) {
        platelets.push({
          id: `${plate.id}-${index++}`,
          plateId: plate.id,
          h3Cell: cell,
          position,
          radius: h3HexRadiusAtResolution(plate.radius, resolution),
          thickness: plate.thickness,
          density: plate.density,
          isActive: true,
        });
      }
    });

    // Cache the result
    this.plateletCache.set(plate.id, platelets);
    return platelets;
  }

  // Removed unused helper methods: getLevel4Children, getLevel1CellsInRadius

  getCachedPlatelets(plateId: string): Platelet[] | undefined {
    return this.plateletCache.get(plateId);
  }

  clearCache(plateId?: string) {
    if (plateId) {
      this.plateletCache.delete(plateId);
    } else {
      this.plateletCache.clear();
      // No need to clear l1ToL4Cache anymore
    }
  }
}
