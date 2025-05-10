import { Vector3 } from 'three';
import * as h3 from 'h3-js';
import { cellToVector } from './cellToVector.ts';
import { flattenVector } from './flattenVector.ts';
import { randomNormal } from './randomNormal.ts';

// Cache for H3 cells at different resolutions
const h3CellCache: { [resolution: number]: string[] } = {};
// Cache for level 0 cells (targets)
let res0CellCache: string[] = [];

/**
 * Get a random H3 cell at the specified resolution
 * Uses a cache to avoid repeated calls to generate H3 cells
 *
 * @param resolution - The H3 resolution (0-15)
 * @returns A random H3 cell
 */
export function getRandomH3Cell(resolution: number): string {
  // If the cache for this resolution is empty, fill it
  if (!h3CellCache[resolution] || h3CellCache[resolution].length === 0) {
    // Generate cells based on resolution
    if (resolution === 0) {
      h3CellCache[resolution] = h3.getRes0Cells();
    } else if (resolution === 1) {
      // Get all resolution 1 cells (there are 7 at this resolution)
      h3CellCache[resolution] = h3
        .getRes0Cells()
        .flatMap((cell) => h3.cellToChildren(cell, 1));
    } else if (resolution === 3) {
      // Generate resolution 3 cells from resolution 0 cells
      h3CellCache[resolution] = h3
        .getRes0Cells()
        .flatMap((cell) => h3.cellToChildren(cell, 3));
    } else {
      // For other resolutions, generate a sample of cells
      const parentRes = Math.max(0, resolution - 2);
      const parentCells = getRandomH3Cell(parentRes);
      h3CellCache[resolution] = h3.cellToChildren(parentCells, resolution);
    }

    // Shuffle the cache to ensure random access
    h3CellCache[resolution] = shuffleArray(h3CellCache[resolution]);
  }

  // Get a random cell from the cache
  const cell = h3CellCache[resolution][0];

  // Remove the cell from the cache to avoid reuse
  h3CellCache[resolution] = h3CellCache[resolution].slice(1);

  return cell;
}

/**
 * Get a random level 0 H3 cell (for target positions)
 * Uses a cache to avoid repeated calls to generate H3 cells
 *
 * @returns A random level 0 H3 cell
 */
export function getRandomTargetCell(): string {
  // If the cache is empty, fill it
  if (res0CellCache.length === 0) {
    res0CellCache = h3.getRes0Cells();
  }

  // Get a random index
  const index = Math.floor(Math.random() * res0CellCache.length);

  // Return the cell at that index (no need to remove it as we want to reuse targets)
  return res0CellCache[index];
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 *
 * @param array - The array to shuffle
 * @returns A new shuffled array
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate a random point on a sphere based on an H3 cell with optional variance
 *
 * @param params - Parameters for generating the random point
 * @returns A Vector3 position on the sphere
 */
export function randomH3Point(params: {
  resolution?: number;
  radius: number;
  variance?: number;
}): Vector3 {
  const { resolution = 3, radius, variance = 0 } = params;

  // Get a random H3 cell
  const cell = getRandomH3Cell(resolution);

  // Convert to 3D position
  let position = cellToVector(cell, radius);

  // Add variance if specified
  if (variance > 0) {
    // Create a random offset vector
    const randomOffset = randomNormal().multiplyScalar(variance);

    // Flatten the offset to be tangential to the planet's surface
    const tangentialOffset = flattenVector({
      vector: randomOffset,
      position: position,
      radius: radius,
      threshold: 0.001, // 0.1% tolerance
    });

    // Add the offset to the position
    const newPosition = position.clone().add(tangentialOffset);

    // Ensure the new position is exactly on the planet's surface
    position = newPosition.normalize().multiplyScalar(radius);
  }

  return position;
}

/**
 * Generate a random target point for velocity calculation
 *
 * @param params - Parameters for generating the target point
 * @returns A Vector3 position on the sphere
 */
export function randomTargetPoint(params: {
  radius: number;
  variance?: number;
}): Vector3 {
  const { radius, variance = 0 } = params;

  // Get a random target cell
  const cell = getRandomTargetCell();

  // Convert to 3D position
  let position = cellToVector(cell, radius);

  // Add variance if specified
  if (variance > 0) {
    // Create a random offset vector
    const randomOffset = randomNormal().multiplyScalar(variance);

    // Flatten the offset to be tangential to the planet's surface
    const tangentialOffset = flattenVector({
      vector: randomOffset,
      position: position,
      radius: radius,
      threshold: 0.001, // 0.1% tolerance
    });

    // Add the offset to the position
    const newPosition = position.clone().add(tangentialOffset);

    // Ensure the new position is exactly on the planet's surface
    position = newPosition.normalize().multiplyScalar(radius);
  }

  return position;
}
