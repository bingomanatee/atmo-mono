import { Vector3 } from 'three';
import { Platelet } from '../schemas/platelet';
import {
  cellToVector,
  cellToChildren,
  h3HexRadiusAtResolution,
} from '@wonderlandlabs/atmo-utils';
import {
  gridDisk,
  getRes0Cells,
  cellToChildren as h3CellToChildren,
} from 'h3-js';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import { floatElevation } from '../../utils/plateUtils';

export class PlateletManager {
  private static plateletCache: Map<string, Platelet[]> = new Map();
  private static allH4CellsCache: string[]; // Cache for all resolution 4 H3 cells

  private sim: PlateSimulationIF; // Store the simulation instance

  constructor(sim: PlateSimulationIF) {
    this.sim = sim;
    // Populate the static cache if it hasn't been already
    if (!PlateletManager.allH4CellsCache) {
      PlateletManager.allH4CellsCache = PlateletManager.generateAllH4Cells();
    }
  }

  generatePlatelets(plateId: string): Platelet[] {
    // Check cache first
    const cached = PlateletManager.plateletCache.get(plateId);
    if (cached) {
      return cached;
    }

    // Get the plate data using the plateId
    const plate = this.sim.getPlate(plateId);
    if (!plate) {
      console.warn(
        `Plate ${plateId} not found in simulation. Cannot generate platelets.`,
      );
      return []; // Return empty array if plate not found
    }

    // Generate platelets by filtering all H4 cells by distance to plate center
    const platelets: Platelet[] = [];
    const resolution = 4; // Level 4 gives us ~100km cells

    // Get the planet radius from the simulation using the plate's planetId
    const planet = this.sim.getPlanet(plate.planetId);
    if (!planet)
      throw new Error(`Planet ${plate.planetId} not found in simulation`);
    const planetRadius = planet.radius;

    let index = 0;
    PlateletManager.allH4CellsCache.forEach((cell) => {
      // Position the platelet on the planet's surface using the planet's radius
      const position = cellToVector(cell, planetRadius);

      // Only include platelets within the plate's radius
      if (position.distanceTo(plate.position) <= plate.radius) {
        // Get neighbor H3 cell IDs
        const neighborCellIds = gridDisk(cell, 1).filter(
          (neighborH3) => neighborH3 !== cell,
        );

        platelets.push({
          id: `${plate.id}-${index++}`,
          plateId: plate.id,
          h3Cell: cell,
          position,
          // Use planetRadius for calculating the platelet radius based on H3 resolution
          radius: h3HexRadiusAtResolution(planetRadius, resolution) * 1.25, // Scale radius by 1.25
          thickness: plate.thickness,
          density: plate.density,
          isActive: true,
          neighbors: [], // Initialize empty neighbors array (will be populated later if needed)
          connections: {}, // Initialize empty connections object
          neighborCellIds: neighborCellIds,
          elevation: floatElevation(plate.thickness, plate.density), // Calculate and add elevation
        });
      }
    });

    // Cache the result
    PlateletManager.plateletCache.set(plate.id, platelets);
    return platelets;
  }

  getCachedPlatelets(plateId: string): Platelet[] | undefined {
    return PlateletManager.plateletCache.get(plateId);
  }

  clearCache(plateId?: string) {
    if (plateId) {
      PlateletManager.plateletCache.delete(plateId);
    } else {
      PlateletManager.plateletCache.clear();
    }
  }

  // Removed unused helper methods: getLevel4Children, getLevel1CellsInRadius

  private static generateAllH4Cells(): string[] {
    const allCells: string[] = [];
    const res0Cells = getRes0Cells();
    const resolution = 4;

    res0Cells.forEach((res0Cell) => {
      const children = h3CellToChildren(res0Cell, resolution);
      allCells.push(...children);
    });

    return allCells;
  }
}
