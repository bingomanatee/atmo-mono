/**
 * Shared utilities for Web Workers
 *
 * This module provides a clean interface for workers to access multiverse
 * and related utilities without directly importing from main thread modules.
 *
 * Strategy 2: Shared Utility Module (Current Approach)
 * - Clean separation of worker dependencies
 * - Easier to maintain and debug
 * - Clear interface for worker functionality
 */

// Re-export multiverse dependencies
export { Multiverse } from '@wonderlandlabs/multiverse';
export { DexieSun } from '../../PlateSimulation/managers/sun/DexieSun';

// Re-export atmo-utils dependencies
export {
  getCellsInRange,
  cellToVector,
  h3HexRadiusAtResolution,
  pointToLatLon,
  latLngToCell,
  isValidCell,
} from '@wonderlandlabs/atmo-utils';

// Re-export Three.js dependencies
export { Vector3 } from 'three';

// Worker-specific initialization helpers
export async function initWorkerMultiverse(
  universeId: string,
  dontClear: boolean = true,
) {
  const { Multiverse } = await import('@wonderlandlabs/multiverse');

  return new Multiverse({
    name: universeId,
    dontClear: dontClear,
  });
}

export async function initWorkerDexieSun(options: {
  dbName: string;
  tableName: string;
  schema: any;
  dontClear?: boolean;
}) {
  const { DexieSun } = await import(
    '../../PlateSimulation/managers/sun/DexieSun'
  );

  return new DexieSun({
    ...options,
    dontClear: options.dontClear || true,
  });
}

// Worker-specific computation helpers
export function createPlateletFromCellWorker(
  cell: string,
  plate: any,
  planetRadius: number,
  resolution: number,
) {
  // Implementation using re-exported utilities
  const position = cellToVector(cell, planetRadius);

  if (!position) {
    return null;
  }

  return {
    id: `platelet_${plate.id}_${cell}`,
    plateId: plate.id,
    h3Cell: cell,
    position: position,
    radius: h3HexRadiusAtResolution(planetRadius, resolution),
    // ... other platelet properties
  };
}

export function filterCellsByPlateRadiusWorker(
  cells: string[],
  plate: any,
  planetRadius: number,
): string[] {
  const plateCenter = new Vector3().copy(plate.position);
  const validCells: string[] = [];

  for (const cell of cells) {
    if (!isValidCell(cell)) continue;

    const cellPosition = cellToVector(cell, planetRadius);
    if (!cellPosition) continue;

    const distance = cellPosition.distanceTo(plateCenter);
    if (distance <= plate.radius) {
      validCells.push(cell);
    }
  }

  return validCells;
}

// Worker-specific gridDisk computation
export async function performGridDiskComputationWorker(
  plateId: string,
  planetRadius: number,
  resolution: number,
  multiverse: any,
) {
  // Get plate data from shared multiverse
  const plate = await multiverse.get('plates').get(plateId);
  if (!plate) {
    throw new Error(`Plate ${plateId} not found in multiverse`);
  }

  // Convert plate position to H3 cell
  const platePosition = new Vector3().copy(plate.position);
  const { lat, lon } = pointToLatLon(platePosition, planetRadius);
  const centralCell = latLngToCell(lat, lon, resolution);

  // Calculate grid disk parameters
  const h3CellRadius = h3HexRadiusAtResolution(planetRadius, resolution);
  const searchRadius = plate.radius * 1.33;
  const ringsNeeded = Math.ceil(searchRadius / h3CellRadius);
  const gridDiskRings = Math.min(ringsNeeded, 20);

  // Get candidate cells
  const candidateCells = getCellsInRange(centralCell, gridDiskRings);

  // Filter cells within plate radius
  const validCells = filterCellsByPlateRadiusWorker(
    candidateCells,
    plate,
    planetRadius,
  );

  // Create platelets
  const platelets = [];
  for (const cell of validCells) {
    const platelet = createPlateletFromCellWorker(
      cell,
      plate,
      planetRadius,
      resolution,
    );
    if (platelet) {
      platelets.push(platelet);

      // Store in shared multiverse
      await multiverse.get('platelets').set(platelet.id, platelet);
    }
  }

  return {
    plateId: plateId,
    plateletCount: platelets.length,
    plateletIds: platelets.map((p) => p.id),
    cellsProcessed: candidateCells.length,
    validCells: validCells.length,
  };
}
