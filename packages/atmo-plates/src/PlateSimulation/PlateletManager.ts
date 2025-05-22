import { Vector3 } from 'three';
import { Plate } from './PlateSimulation';
import { Platelet } from './schemas/platelet';
import {
  cellToVector,
  latLngToCell,
  cellToChildren,
} from '@wonderlandlabs/atmo-utils';
import * as h3 from 'h3-js';

export class PlateletManager {
  private plateletCache: Map<string, Platelet[]>;
  private l1ToL4Cache: Map<string, string[]>;

  constructor() {
    this.plateletCache = new Map();
    this.l1ToL4Cache = new Map();
  }

  generatePlatelets(plate: Plate): Platelet[] {
    // Check cache first
    const cached = this.plateletCache.get(plate.id);
    if (cached) {
      return cached;
    }

    // Generate platelets using H3 cells
    const platelets: Platelet[] = [];
    const resolution = 4; // Level 4 gives us ~100km cells

    // 1. Get the H3 cell for the plate's center at level 1
    const centerCell = latLngToCell(
      plate.position.y / plate.radius,
      plate.position.x / plate.radius,
      1,
    );

    // 2. Get all level 1 cells within 150% of radius
    const level1Cells = this.getLevel1CellsInRadius(
      centerCell,
      plate.radius * 1.5,
    );

    // 3. For each level 1 cell, get all level 4 children (using cache)
    const level4Cells = new Set<string>();
    level1Cells.forEach((cell) => {
      const children = this.getLevel4Children(cell);
      children.forEach((child) => level4Cells.add(child));
    });

    // 4. Convert level 4 cells to platelets if within plate radius
    let index = 0;
    level4Cells.forEach((cell) => {
      const position = cellToVector(cell, plate.radius);

      // Only include platelets within the plate's radius
      if (position.distanceTo(plate.position) <= plate.radius) {
        platelets.push({
          id: `${plate.id}-${index++}`,
          plateId: plate.id,
          position,
          radius: plate.radius / 100, // Approximate platelet radius
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

  private getLevel4Children(l1Cell: string): string[] {
    // Check cache first
    const cached = this.l1ToL4Cache.get(l1Cell);
    if (cached) {
      return cached;
    }

    // Get level 4 children and cache them
    const children = cellToChildren(l1Cell, 4);
    this.l1ToL4Cache.set(l1Cell, children);
    return children;
  }

  private getLevel1CellsInRadius(centerCell: string, radius: number): string[] {
    const cells = new Set<string>();
    const centerPos = cellToVector(centerCell, 1);

    // Start with the center cell
    cells.add(centerCell);

    // Get neighboring cells at level 1
    const neighbors = h3.gridDisk(centerCell, 5); // Get cells in a 5-ring around center
    neighbors.forEach((cell) => {
      const pos = cellToVector(cell, 1);
      if (pos.distanceTo(centerPos) <= radius) {
        cells.add(cell);
      }
    });

    return Array.from(cells);
  }

  getCachedPlatelets(plateId: string): Platelet[] | undefined {
    return this.plateletCache.get(plateId);
  }

  clearCache(plateId?: string) {
    if (plateId) {
      this.plateletCache.delete(plateId);
    } else {
      this.plateletCache.clear();
      this.l1ToL4Cache.clear(); // Also clear the L1->L4 mapping cache
    }
  }
}
