import { Vector3 } from 'three';
import {
  cellToVector,
  latLngToCell,
  cellToChildren,
  h3HexRadiusAtResolution,
  cellToLatLng,
  getResolution,
} from '@wonderlandlabs/atmo-utils';
import { gridDisk } from 'h3-js';
import type { Platelet } from '../schemas/platelet';
import type { SimPlateIF } from '../types.PlateSimulation';
import { floatElevation } from '../../utils/plateUtils';

/**
 * Converts a 3D position to latitude and longitude
 */
export function positionToLatLng(
  position: Vector3,
  planetRadius: number,
): { lat: number; lng: number } {
  return {
    lat: Math.asin(position.y / planetRadius),
    lng: Math.atan2(position.z, position.x),
  };
}

/**
 * Gets the H0 cell for a given position
 */
export function getH0CellForPosition(
  position: Vector3,
  planetRadius: number,
): string {
  const { lat, lng } = positionToLatLng(position, planetRadius);
  return latLngToCell(lat, lng, 0);
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
  return cells.filter((cell) => {
    const position = cellToVector(cell, planetRadius);
    const distance = position.distanceTo(plate.position);
    // Only include cells within the plate's true radius
    return distance <= plate.radius;
  });
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
  index: number,
): Platelet {
  const position = cellToVector(cell, planetRadius);
  const neighborCellIds = gridDisk(cell, 1).filter(
    (neighbor) => neighbor !== cell,
  );

  return {
    id: `${plate.id}-${index}`,
    plateId: plate.id,
    h3Cell: cell,
    position,
    radius: h3HexRadiusAtResolution(planetRadius, resolution) * 1.25,
    thickness: plate.thickness,
    density: plate.density,
    isActive: true,
    neighbors: [],
    connections: {},
    neighborCellIds,
    elevation: floatElevation(plate.thickness, plate.density),
    mass: plate.thickness * plate.density * Math.PI * Math.pow(plate.radius, 2),
    elasticity: 0.5,
    velocity: new Vector3(),
  };
}

/**
 * Processes a single H0 cell and its neighbors recursively
 */
export function processH0Cell(
  h0Cell: string,
  plate: SimPlateIF,
  planetRadius: number,
  resolution: number,
  processedH0Cells: Set<string>,
  platelets: Platelet[],
  plateletIds: string[],
  index: { value: number },
): void {
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
  validPlateletCells.forEach((cell) => {
    const platelet = createPlateletFromCell(
      cell,
      plate,
      planetRadius,
      resolution,
      index.value++,
    );
    platelets.push(platelet);
    plateletIds.push(platelet.id);
  });

  // Process neighboring H0 cells
  const neighborH0Cells = getNeighboringH0Cells(h0Cell);
  neighborH0Cells.forEach((neighborH0) => {
    if (!processedH0Cells.has(neighborH0)) {
      processH0Cell(
        neighborH0,
        plate,
        planetRadius,
        resolution,
        processedH0Cells,
        platelets,
        plateletIds,
        index,
      );
    }
  });
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
