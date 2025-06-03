import {
  cellToChildren,
  cellToVector,
  getH3CellForPosition,
  getNeighbors,
  h3HexRadiusAtResolution,
  latLngToCell,
  pointToLatLon,
} from '@wonderlandlabs/atmo-utils';
import { Vector3 } from 'three';
import { floatElevation } from '../../utils/plateUtils';
import { log } from '../../utils/utils';
import type { Platelet } from '../schemas/platelet';
import type { PlateletIF, SimPlateIF } from '../types.PlateSimulation';
import { H0_CELLS } from './h0Cells';

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
export async function filterCellsByPlateRadius(
  cells: string[],
  plate: SimPlateIF,
  planetRadius: number,
): Promise<string[]> {
  log(
    `🔍🔍🔍🔍 FILTER DEBUG: Checking ${cells.length} cells for plate ${plate.id}
       Plate center: (${plate.position.x.toFixed(1)}, ${plate.position.y.toFixed(1)}, ${plate.position.z.toFixed(1)})
    Plate radius: ${plate.radius}km
    Planet radius: ${planetRadius}km
    `,
  );

  // Calculate distances for all cells
  // Both plate position and cell positions are in kilometers
  const platePositionKm = new Vector3().copy(plate.position);

  const cellDistances = await Promise.all(
    cells.map(async (cell) => {
      const position = await cellToVector(cell, planetRadius);
      const distanceKm = position.distanceTo(platePositionKm); // Both in km now

      return { cell, distance: distanceKm }; // Store distance in kilometers
    }),
  );

  // Sort by distance (closest first)
  cellDistances.sort((a, b) => a.distance - b.distance);

  // Filter to only keep cells within the plate's radius for circular shape
  // Everything in kilometers - no meter conversions!
  const plateRadiusKm = plate.radius; // plate.radius is already in km
  const keptCells = cellDistances
    .filter((item) => item.distance <= plateRadiusKm)
    .map((item) => item.cell);

  log(
    `�� Plate ${plate.id}: Initially filtered ${keptCells.length}/${cells.length} cells within ${plate.radius}km radius`,
  );

  if (keptCells.length === 0 && cells.length > 0) {
    const closest = cellDistances[0];
    log(
      `❌ NO CELLS KEPT by radius filter! Closest cell was ${cellDistances[0]?.distance.toFixed(2)}km away, but plate radius is ${plateRadiusKm}km
        This suggests a unit mismatch or a very small plate/large H0 cell. Nearest cell fallback will be used if no platelets are ultimately generated.`,
    );
  }

  return keptCells;
}

/**
 * Gets neighboring H0 cells for a given H0 cell
 */
export async function getNeighboringH0Cells(h0Cell: string): Promise<string[]> {
  const neighbors = await getNeighbors(h0Cell);
  // Include the cell itself for gridDisk behavior
  neighbors.push(h0Cell);
  return neighbors;
}

/**
 * Creates a simple fallback platelet at the plate center position
 */
export function createCenterPlatelet(
  plate: SimPlateIF,
  planetRadius: number,
  resolution: number,
): PlateletIF {
  // Create a unique ID for the center platelet
  const plateletId = `${plate.id}-center`;

  log(
    `🎯 Creating simple center platelet for plate ${plate.id} at plate position`,
  );

  // Use the plate's actual position directly - no grid snapping needed
  const position = new Vector3().copy(plate.position);

  // Calculate a reasonable radius for the platelet (same as other platelets at this resolution)
  const calculatedRadius = h3HexRadiusAtResolution(planetRadius, resolution);

  // Use half the H3 radius for coverage area (consistent with createPlateletFromCell)
  const coverageRadius = calculatedRadius * 0.5;

  // Calculate elevation (same as normal platelets)
  const elevation = floatElevation(plate.thickness, plate.density);

  return {
    id: plateletId,
    plateId: plate.id,
    planetId: plate.planetId, // Add planetId from plate
    h3Cell: getH3CellForPosition(position, planetRadius, resolution), // Use valid H3 cell for the plate position
    position: position,
    radius: coverageRadius,
    thickness: plate.thickness,
    density: plate.density,
    isActive: true,
    connections: {},
    neighborCellIds: [], // No H3 neighbors since this isn't on the grid
    elevation: elevation,
    mass:
      plate.thickness * plate.density * Math.PI * Math.pow(calculatedRadius, 2),
    elasticity: 0.5,
    velocity: new Vector3(),
    averageNeighborDistance: calculatedRadius * 2, // Reasonable default
  };
}

/**
 * Creates a platelet object from a cell
 */
export async function createPlateletFromCell(
  cell: string,
  plate: SimPlateIF,
  planetRadius: number,
  resolution: number,
): Promise<PlateletIF> {
  const position = await cellToVector(cell, planetRadius);

  // Ensure position is valid
  if (!position) {
    throw new Error(`Failed to get position for H3 cell ${cell}`);
  }

  const neighborCellIds = gridDisk(cell, 1).filter(
    (neighbor) => neighbor !== cell,
  );

  // Calculate average distance to neighbor cell positions
  let totalNeighborDistance = 0;
  let validNeighborCount = 0;

  for (const cell of neighborCellIds) {
    try {
      const neighborPosition = await cellToVector(cell, planetRadius);
      totalNeighborDistance += position.distanceTo(neighborPosition);
      validNeighborCount++;
    } catch (error) {
      // Handle cases where cellToVector might fail for some reason (e.g., invalid cell ID)
      console.error(`Error getting position for neighbor cell ${cell}:`, error);
    }
  }

  const averageNeighborDistance =
    validNeighborCount > 0 ? totalNeighborDistance / validNeighborCount : 0; // Default to 0 if no valid neighbors

  // Use H3 cell radius directly for consistent, appropriate platelet sizes
  // This ensures platelets are sized correctly for their H3 resolution level
  const calculatedRadius = h3HexRadiusAtResolution(planetRadius, resolution);

  // Use half the distance between centers as the coverage radius
  // This represents the actual area each platelet should cover
  const coverageRadius = averageNeighborDistance
    ? averageNeighborDistance * 0.5
    : calculatedRadius * 0.5;

  return {
    id: `${plate.id}-${cell}`,
    plateId: plate.id,
    planetId: plate.planetId, // Add planetId from plate
    h3Cell: cell,
    position,
    radius: coverageRadius,
    thickness: plate.thickness,
    density: plate.density,
    isActive: true,
    connections: {},
    neighborCellIds, // H3 neighbor cell IDs
    elevation: floatElevation(plate.thickness, plate.density),
    mass:
      plate.thickness * plate.density * Math.PI * Math.pow(calculatedRadius, 2),
    elasticity: 0.5,
    velocity: new Vector3(),
    averageNeighborDistance: averageNeighborDistance,
  };
}

/**
 * Processes H0 cells within a threshold distance and generates platelets with neighbor expansion.
 */
export async function processH0Cell(
  h0Cell: string,
  plate: SimPlateIF,
  planetRadius: number,
  resolution: number,
  plateletsCollection: any,
): Promise<string[]> {
  // Return the list of H3 cells found in this H0 cell
  console.log(
    `🔍============================= Getting H3 cells from H0 cell ${h0Cell} for plate ${plate.id}`,
  );

  // Get all cells at the specified resolution within this H0 cell
  const plateletCells = getCellsInH0Cell(h0Cell, resolution);
  console.log(
    `   Found ${plateletCells.length} resolution-${resolution} cells in H0 cell ${h0Cell}
      h0 center: ${cellToVector(h0Cell, planetRadius).round().toArray().join(',')}
    `,
  );

  return plateletCells; // Just return the cells, filtering and processing happens in generateCircularPlatelets
}

/**
 * Generate platelets in a perfect circular pattern around the plate center using neighbor expansion
 */
export async function generateCircularPlatelets(
  plate: SimPlateIF,
  planetRadius: number,
  resolution: number,
  plateletsCollection: any,
): Promise<void> {
  console.log(`🔧 GENERATING CIRCULAR PLATELETS for plate ${plate.id}:`);
  console.log(`   Plate radius: ${plate.radius}km`);
  console.log(`   Planet radius: ${planetRadius}km`);
  console.log(`   Resolution: ${resolution}`);

  const plateRadiusKm = plate.radius;
  const plateCenter = new Vector3(
    plate.position.x,
    plate.position.y,
    plate.position.z,
  );

  // Calculate the radius of an H0 cell at the planet's radius
  const h0CellRadiusKm = h3HexRadiusAtResolution(planetRadius, 0);

  // Define the distance threshold for including H0 cells (plate radius + 2 H0 radii buffer)
  const distanceThreshold = plateRadiusKm + 2 * h0CellRadiusKm;
  console.log(
    `   Distance threshold for including H0 cells: ${distanceThreshold.toFixed(2)}km`,
  );

  const potentialCandidateCells = new Set<string>();
  let relevantH0CellsCount = 0;

  // Collect all H3 cells from relevant H0 cells
  console.log(`   Collecting H3 cells from H0 cells within threshold...`);
  for (const h0Cell of H0_CELLS) {
    const h0CellPosition = await cellToVector(h0Cell, planetRadius);
    const distanceToPlate = h0CellPosition.distanceTo(plateCenter);

    if (distanceToPlate <= distanceThreshold) {
      relevantH0CellsCount++;
      const h3CellsInH0 = getCellsInH0Cell(h0Cell, resolution);
      h3CellsInH0.forEach((cell) => potentialCandidateCells.add(cell));
    } else {
      // console.log(`     H0 cell ${h0Cell} is outside the threshold - skipping.`,); // Too much logging
    }
  }

  console.log(
    `   Collected ${potentialCandidateCells.size} potential candidate H3 cells from ${relevantH0CellsCount} H0 cells.`,
  );

  const processedPlateletCells = new Set<string>();
  const cellsToProcess: string[] = []; // Use an array as a simple queue
  const createdPlateletIds: string[] = []; // To track if any platelets were created

  // Initial filtering: Add cells whose centers are within the plate radius to the queue
  console.log(
    `   Performing initial distance-based filtering and queuing valid cells...`,
  );
  const initiallyValidCells = await filterCellsByPlateRadius(
    Array.from(potentialCandidateCells),
    plate,
    planetRadius,
  );
  initiallyValidCells.forEach((cell) => {
    if (!processedPlateletCells.has(cell)) {
      cellsToProcess.push(cell);
      processedPlateletCells.add(cell); // Mark as processed when added to queue to avoid duplicates
    }
  });

  console.log(
    `   Initially queued ${cellsToProcess.length} cells for processing.`,
  );

  // Neighbor expansion process
  console.log(`   Starting neighbor expansion...`);
  let cellsProcessedCount = 0;
  while (cellsToProcess.length > 0) {
    const currentCell = cellsToProcess.shift()!; // Dequeue cell
    cellsProcessedCount++;

    // Create platelet for the current cell
    const platelet = await createPlateletFromCell(
      currentCell,
      plate,
      planetRadius,
      resolution,
    );
    await plateletsCollection.set(platelet.id, platelet);
    createdPlateletIds.push(platelet.id);

    // Get neighbors and enqueue if valid and not processed
    const neighbors = gridDisk(currentCell, 1).filter(
      (cell) => cell !== currentCell,
    );
    for (const neighbor of neighbors) {
      if (!processedPlateletCells.has(neighbor)) {
        // Check if neighbor's center is within plate radius
        try {
          const neighborPosition = await cellToVector(neighbor, planetRadius);
          const distanceToPlate = neighborPosition.distanceTo(plateCenter);

          if (distanceToPlate <= plateRadiusKm) {
            cellsToProcess.push(neighbor);
            processedPlateletCells.add(neighbor); // Mark as processed when added to queue
          }
        } catch (error) {
          console.warn(`❌ Skipping invalid neighbor cell ${neighbor}:`, error);
        }
      }
    }
  }

  console.log(
    `   Neighbor expansion complete. Processed ${cellsProcessedCount} cells.`,
  );

  // Fallback: If no platelets were created, add one for the nearest H3 cell
  if (createdPlateletIds.length === 0) {
    console.warn(
      `⚠️ No platelets generated for plate ${plate.id}. Creating fallback platelet.`,
    );
    const centerPlatelet = createCenterPlatelet(
      plate,
      planetRadius,
      resolution,
    );
    await plateletsCollection.set(centerPlatelet.id, centerPlatelet);
    createdPlateletIds.push(centerPlatelet.id); // Add fallback platelet ID
  }

  console.log(
    `✅ Finished generating ${createdPlateletIds.length} platelets for plate ${plate.id}.`,
  );
}

/**
 * Calculate the great circle distance between two points on a sphere
 * Returns distance in degrees
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 1; // Unit sphere
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return toDeg(c);
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDeg(radians: number): number {
  return radians * (180 / Math.PI);
}
