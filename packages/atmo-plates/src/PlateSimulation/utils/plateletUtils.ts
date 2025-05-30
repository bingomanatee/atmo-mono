import {
  cellToChildren,
  cellToLatLng,
  cellToVector,
  getResolution,
  h3HexRadiusAtResolution,
  latLngToCell,
  pointToLatLon,
} from '@wonderlandlabs/atmo-utils';
import type { CollSyncIF } from '@wonderlandlabs/multiverse/src/types.coll';
import { gridDisk } from 'h3-js';
import { Vector3 } from 'three';
import { floatElevation } from '../../utils/plateUtils';
import type { Platelet } from '../schemas/platelet';
import type { SimPlateIF } from '../types.PlateSimulation';

declare module '@wonderlandlabs/atmo-utils';

/**
 * Gets the H0 cell for a given position
 */
export function getH0CellForPosition(
  position: Vector3,
  planetRadius: number,
): string {
  const { lat, lon } = pointToLatLon(position, planetRadius);
  return latLngToCell(lat, lon, 0);
}

/**
 * Gets all cells at the specified resolution within an H0 cell
 */
export function getCellsInH0Cell(h0Cell: string, resolution: number): string[] {
  return cellToChildren(h0Cell, resolution);
}

/**
 * Filters cells to only those within the plate's radius
 */
export function filterCellsByPlateRadius(
  cells: string[],
  plate: SimPlateIF,
  planetRadius: number,
): string[] {
  // Calculate distances for all cells
  const cellDistances = cells.map((cell) => {
    const position = cellToVector(cell, planetRadius);
    const distance = position.distanceTo(plate.position);
    return { cell, distance };
  });

  // Sort by distance (closest first)
  cellDistances.sort((a, b) => a.distance - b.distance);

  // Keep at least 88% of cells (remove no more than 12%)
  const maxRemovalCount = Math.floor(cells.length * 0.12);
  const minKeepCount = cells.length - maxRemovalCount;

  // Keep the closest cells up to the minimum count
  const keptCells = cellDistances
    .slice(0, Math.max(minKeepCount, cells.length))
    .map((item) => item.cell);

  console.log(
    `🔍 Plate ${plate.id}: Kept ${keptCells.length}/${cells.length} cells (${((keptCells.length / cells.length) * 100).toFixed(1)}% retention)`,
  );

  return keptCells;
}

/**
 * Gets neighboring H0 cells for a given H0 cell
 */
export function getNeighboringH0Cells(h0Cell: string): string[] {
  return gridDisk(h0Cell, 1);
}

/**
 * Creates a platelet object from a cell
 */
export function createPlateletFromCell(
  cell: string,
  plate: SimPlateIF,
  planetRadius: number,
  resolution: number,
): Platelet {
  const position = cellToVector(cell, planetRadius);

  const neighborCellIds = gridDisk(cell, 1).filter(
    (neighbor) => neighbor !== cell,
  );

  // Calculate average distance to neighbor cell positions
  let totalNeighborDistance = 0;
  let validNeighborCount = 0;

  neighborCellIds.forEach((neighborH3Cell) => {
    try {
      const neighborPosition = cellToVector(neighborH3Cell, planetRadius);
      totalNeighborDistance += position.distanceTo(neighborPosition);
      validNeighborCount++;
    } catch (error) {
      // Handle cases where cellToVector might fail for some reason (e.g., invalid cell ID)
      console.error(
        `Error getting position for neighbor cell ${neighborH3Cell}:`,
        error,
      );
    }
  });

  const averageNeighborDistance =
    validNeighborCount > 0 ? totalNeighborDistance / validNeighborCount : 0; // Default to 0 if no valid neighbors

  // Calculate radius based on average neighbor distance (half the average distance)
  // Use H3 radius as a fallback if no valid neighbors are found.
  const calculatedRadius =
    averageNeighborDistance > 0
      ? averageNeighborDistance / 2
      : h3HexRadiusAtResolution(planetRadius, resolution);

  return {
    id: `${plate.id}-${cell}`,
    plateId: plate.id,
    h3Cell: cell,
    position,
    radius: calculatedRadius, // Set radius based on calculated average neighbor distance
    thickness: plate.thickness,
    density: plate.density,
    isActive: true,
    neighbors: [],
    connections: {},
    neighborCellIds,
    elevation: floatElevation(plate.thickness, plate.density),
    mass:
      plate.thickness * plate.density * Math.PI * Math.pow(calculatedRadius, 2), // Use calculated radius for mass
    elasticity: 0.5,
    velocity: new Vector3(),
    averageNeighborDistance: averageNeighborDistance, // Store the calculated average distance
  };
}

/**
 * Processes a single H0 cell and its neighbors recursively, adding platelets directly to the collection
 */
export async function processH0Cell(
  h0Cell: string,
  plate: SimPlateIF,
  planetRadius: number,
  resolution: number,
  processedH0Cells: Set<string>,
  plateletsCollection: any, // Changed from CollSyncIF to any since it's async
): Promise<void> {
  if (processedH0Cells.has(h0Cell)) return;
  processedH0Cells.add(h0Cell);

  // Get all cells at the specified resolution within this H0 cell
  const plateletCells = getCellsInH0Cell(h0Cell, resolution);

  // Filter cells within radius of the plate
  const validPlateletCells = filterCellsByPlateRadius(
    plateletCells,
    plate,
    planetRadius,
  );

  // Process valid cells
  for (const cell of validPlateletCells) {
    const platelet = createPlateletFromCell(
      cell,
      plate,
      planetRadius,
      resolution,
    );
    await plateletsCollection.set(platelet.id, platelet);
  }

  // Process neighboring H0 cells
  const neighborH0Cells = getNeighboringH0Cells(h0Cell);
  for (const neighborH0 of neighborH0Cells) {
    if (!processedH0Cells.has(neighborH0)) {
      await processH0Cell(
        neighborH0,
        plate,
        planetRadius,
        resolution,
        processedH0Cells,
        plateletsCollection,
      );
    }
  }
}

/**
 * Get all H3 cells at a given resolution level that cover a sphere
 * @param resolution The H3 resolution level
 * @param radius The radius of the sphere
 * @returns Array of H3 cell indices
 */
export function getAllH3CellsAtLevel(
  resolution: number,
  radius: number,
): string[] {
  // Start with a base cell at the north pole
  const baseCell = latLngToCell(90, 0, resolution);
  const cells = new Set<string>();
  const queue = [baseCell];

  // Use a breadth-first search to find all cells
  while (queue.length > 0) {
    const currentCell = queue.shift()!;
    if (cells.has(currentCell)) continue;

    // Get the center point of the cell
    const { lat, lng } = cellToLatLng(currentCell);
    // Convert lat/lng to radians
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    // Calculate position on sphere
    const pos = new Vector3(
      radius * Math.cos(latRad) * Math.cos(lngRad),
      radius * Math.sin(latRad),
      radius * Math.cos(latRad) * Math.sin(lngRad),
    );

    // Only add cells that are on the sphere (with a small tolerance)
    const distanceFromCenter = pos.length();
    if (Math.abs(distanceFromCenter - radius) < 1e-6) {
      cells.add(currentCell);

      // Get neighboring cells and add them to the queue
      const neighbors = getNeighbors(currentCell);
      for (const neighbor of neighbors) {
        if (!cells.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  return Array.from(cells);
}

/**
 * Get all neighboring cells for a given H3 cell
 * @param cell The H3 cell index
 * @returns Array of neighboring cell indices
 */
function getNeighbors(cell: string): string[] {
  const { lat, lng } = cellToLatLng(cell);
  const resolution = getResolution(cell);

  // Get cells in a small grid around the current cell
  const neighbors: string[] = [];
  const step = 0.1; // Small step in degrees

  for (let dlat = -step; dlat <= step; dlat += step) {
    for (let dlng = -step; dlng <= step; dlng += step) {
      if (dlat === 0 && dlng === 0) continue;
      const neighbor = latLngToCell(lat + dlat, lng + dlng, resolution);
      if (neighbor !== cell) {
        neighbors.push(neighbor);
      }
    }
  }

  return neighbors;
}
