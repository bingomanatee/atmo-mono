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
export { DexieSun } from '../../PlateSimulation/sun/DexieSun';

// Re-export atmo-utils dependencies
export {
  getCellsInRange,
  cellToVector,
  getNeighborsSync,
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

// SharedArrayBuffer-based simulator state sharing
export interface SharedSimulatorState {
  planetRadius: number;
  plateCount: number;
  // Add more shared state as needed
}

// Create shared memory buffer for simulator state
export function createSharedSimulatorBuffer(): {
  buffer: SharedArrayBuffer;
  view: Float32Array;
  state: SharedSimulatorState;
} {
  // Check if SharedArrayBuffer is available
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error(
      'SharedArrayBuffer not available - required for shared simulator state',
    );
  }

  const buffer = new SharedArrayBuffer(1024); // 1KB shared memory
  const view = new Float32Array(buffer);

  // Memory layout:
  // [0] = planetRadius
  // [1] = plateCount
  // [2-255] = reserved for future use

  const state: SharedSimulatorState = {
    get planetRadius() {
      return view[0];
    },
    set planetRadius(value: number) {
      view[0] = value;
    },
    get plateCount() {
      return view[1];
    },
    set plateCount(value: number) {
      view[1] = value;
    },
  };

  return { buffer, view, state };
}

// Worker-side access to shared simulator state
export function accessSharedSimulatorState(
  buffer: SharedArrayBuffer,
): SharedSimulatorState {
  const view = new Float32Array(buffer);

  return {
    get planetRadius() {
      return view[0];
    },
    set planetRadius(value: number) {
      view[0] = value;
    },
    get plateCount() {
      return view[1];
    },
    set plateCount(value: number) {
      view[1] = value;
    },
  };
}

export async function initWorkerDexieSun(options: {
  dbName: string;
  tableName: string;
  schema: any;
  dontClear?: boolean;
}) {
  const { DexieSun } = await import('../../PlateSimulation/sun/DexieSun');

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

  // Calculate neighbor H3 cell IDs
  const neighborCellIds = getNeighborsSync(cell);

  // Use half the H3 radius for coverage area (consistent with main thread)
  const h3Radius = h3HexRadiusAtResolution(planetRadius, resolution);
  const coverageRadius = h3Radius * 0.5;

  return {
    id: `${plate.id}-${cell}`, // Use consistent ID format
    plateId: plate.id,
    planetId: plate.planetId, // Add planetId from plate
    h3Cell: cell, // Include h3Cell property
    position: position,
    radius: coverageRadius,
    thickness: plate.thickness || 1.0,
    density: plate.density || 1.0,
    isActive: true,
    connections: {},
    neighborCellIds: neighborCellIds, // H3 neighbor cell IDs
    mass:
      (plate.thickness || 1.0) *
      (plate.density || 1.0) *
      Math.PI *
      Math.pow(h3Radius, 2),
    elasticity: 0.5,
    velocity: { x: 0, y: 0, z: 0 }, // Plain object for worker context
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
