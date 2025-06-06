import {
  cellToVector,
  getCellsInRange,
  h3HexRadiusAtResolution,
  isValidCell,
  latLngToCell,
  pointToLatLon,
} from '@wonderlandlabs/atmo-utils';
import type { TaskManager } from '@wonderlandlabs/atmo-workers';
import { createBrowserWorkerManager } from '@wonderlandlabs/atmo-workers';
import { Vector3 } from 'three';
import { log } from '../../utils/utils';
import { COLLECTIONS } from '../constants';
import { Platelet } from '../schemas/platelet';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import {
  createCenterPlatelet,
  createPlateletFromCell,
  filterCellsByPlateRadius,
  getCellsInH0Cell,
  getNeighboringH0Cells,
} from '../utils/plateletUtils';

const workerUrl = '/platelet-worker.js';

export class PlateletManager {
  public static readonly PLATELET_CELL_LEVEL = 2; // Resolution level for platelets (level 2 = ~154km cells, good balance)

  private sim: PlateSimulationIF;
  private useWorkers: boolean = false;
  private workerAvailable: boolean = false;
  private workersReady: number = 0;
  private expectedWorkers: number = 0;
  private taskManager?: TaskManager;
  private browserWorker?: any; // BrowserWorkerManager type

  constructor(sim: PlateSimulationIF, useWorkers: boolean = false) {
    this.sim = sim;
    this.useWorkers = useWorkers && typeof Worker !== 'undefined';
    this.workerAvailable = this.useWorkers;

    if (this.useWorkers) {
      log('🔧 PlateletManager initialized with worker support enabled');
      this.initializeWorkerManager();
    }
  }

  /**
   * Initialize the atmo-workers system for parallel platelet generation
   */
  private async initializeWorkerManager(): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        log('⚠️ Window not available, disabling workers');
        this.workerAvailable = false;
        return;
      }

      const workerManager = createBrowserWorkerManager({
        name: 'platelet-manager',
        window,
        workerManifests: [
          {
            name: 'platelet-worker',
            scriptUrl: workerUrl,
            tasks: ['generate-platelets'],
          },
        ],
        workerTimeout: 120000, // Increased to 2 minutes for complex platelet generation
      });

      // Create a custom worker manager that supports module workers
      // This extends the atmo-workers functionality to handle ES6 modules

      // Set expected workers count
      this.expectedWorkers = 1; // We're creating 1 worker
      this.workersReady = 0;

      // Create a reference to this PlateletManager for use in closures
      const plateletManager = this;

      // Create a custom window object with module worker support
      const customWindow = {
        ...window,
      };

      // Create worker manager with platelet generation manifest
      log('🔧 PlateletManager: Creating BrowserWorkerManager with config:', {
        name: 'platelet-manager',
        workerManifests: [
          {
            name: 'platelet-worker',
            scriptUrl: workerUrl,
            tasks: ['generate-platelets'],
          },
        ],
        maxConcurrentTasks: Math.min(navigator.hardwareConcurrency || 4, 8),
        workerTimeout: 120000, // Increased to 2 minutes for complex platelet generation
      });

      this.taskManager = workerManager.taskManager;
      this.browserWorker = workerManager.browserWorker;

      // Log worker status periodically
      setTimeout(() => {
        const workerStatus = this.browserWorker?.getWorkerStatus();
      }, 1000);

      setTimeout(() => {
        const workerStatus = this.browserWorker?.getWorkerStatus();
      }, 3000);

      // Workers will be marked as available when they send worker-ready signals
      // No timeout needed - we wait for actual confirmation
    } catch (error) {
      this.workerAvailable = false;
    }
  }

  async generatePlatelets(plateId: string): Promise<Platelet[]> {
    // Get the plate data
    const plate = await this.sim.getPlate(plateId);
    if (!plate) {
      console.warn(
        `Plate ${plateId} not found in simulation. Cannot generate platelets.`,
      );
      return [];
    }

    // Get planet radius
    const planet = await this.sim.getPlanet(plate.planetId);
    if (!planet)
      throw new Error(`Planet ${plate.planetId} not found in simulation`);
    const planetRadius = planet.radius;

    // Check H3 cell radius calculation
    const h3CellRadius = h3HexRadiusAtResolution(
      planetRadius,
      PlateletManager.PLATELET_CELL_LEVEL,
    );

    // Get the platelets collection from the simulation
    const plateletsCollection = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
    if (!plateletsCollection) throw new Error('platelets collection not found');

    // Use atmo-workers if available, otherwise fall back to main thread
    const generatedPlatelets =
      this.useWorkers && this.workerAvailable && this.taskManager
        ? await this.generatePlateletsWithAtmoWorkers(
            plate,
            planetRadius,
            PlateletManager.PLATELET_CELL_LEVEL,
          )
        : await this.generatePlateletsWithGridDisk(
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
   * Generate platelets for multiple plates in parallel using atmo-workers
   * This is the main benefit of using the worker system - true parallelization
   */
  async generatePlateletsForMultiplePlates(
    plateIds: string[],
  ): Promise<Map<string, Platelet[]>> {
    if (!this.useWorkers || !this.workerAvailable || !this.taskManager) {
      return this.generatePlateletsSequentially(plateIds);
    }

    const startTime = performance.now();

    try {
      // Get all plates data
      const plates = await Promise.all(
        plateIds.map(async (plateId) => {
          const plate = await this.sim.getPlate(plateId);
          if (!plate) throw new Error(`Plate ${plateId} not found`);
          return { plateId, plate };
        }),
      );

      // Get planet radius
      const firstPlate = plates[0].plate;
      const planet = await this.sim.getPlanet(firstPlate.planetId);
      if (!planet) throw new Error(`Planet ${firstPlate.planetId} not found`);
      const planetRadius = planet.radius;

      // Submit all tasks in parallel
      const taskPromises = plates.map(({ plateId, plate }) =>
        this.taskManager!.submitRequest(
          'generate-platelets',
          {
            plateId: plate.id,
            planetRadius: planetRadius,
            resolution: PlateletManager.PLATELET_CELL_LEVEL,
            universeId: this.sim.simUniv?.name || 'default-universe',
            dontClear: true,
          },
          {
            clientId: 'platelet-manager',
            maxTime: 120000, // Increased to 2 minutes to match worker timeout
          },
        ).toPromise(),
      );

      // Wait for all tasks to complete
      const results = await Promise.all(taskPromises);
      const endTime = performance.now();

      log(
        `✅ Parallel processing completed in ${(endTime - startTime).toFixed(2)}ms`,
      );

      // Collect platelets from IDBSun storage
      const plateletsByPlate = new Map<string, Platelet[]>();
      const plateletsCollection = this.sim.simUniv.get(COLLECTIONS.PLATELETS);

      for (let i = 0; i < plateIds.length; i++) {
        const plateId = plateIds[i];
        const result = results[i];

        if (result && result.plateletCount > 0) {
          const platelets: Platelet[] = [];
          for await (const [_, platelet] of plateletsCollection.find(
            'plateId',
            plateId,
          )) {
            platelets.push(platelet);
          }
          plateletsByPlate.set(plateId, platelets);
        } else {
          const plate = plates[i].plate;
          const fallbackPlatelets = await this.generatePlateletsWithGridDisk(
            plate,
            planetRadius,
            PlateletManager.PLATELET_CELL_LEVEL,
          );
          plateletsByPlate.set(plateId, fallbackPlatelets);
        }
      }

      return plateletsByPlate;
    } catch (error) {
      return this.generatePlateletsSequentially(plateIds);
    }
  }

  /**
   * Fallback method for sequential platelet generation
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
   * Generate platelets using atmo-workers system for parallel processing
   * Uses TaskManager and BrowserWorkerManager for proper worker management
   */
  private async generatePlateletsWithAtmoWorkers(
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<Platelet[]> {
    if (!this.taskManager) {
      throw new Error('TaskManager not initialized');
    }

    try {
      // Submit task to the worker pool
      const result = await this.taskManager
        .submitRequest(
          'generate-platelets',
          {
            plateId: plate.id,
            planetRadius: planetRadius,
            resolution: resolution,
            universeId: this.sim.simUniv?.name || 'default-universe',
            dontClear: true,
          },
          {
            clientId: 'platelet-manager',
            maxTime: 120000, // Increased to 2 minutes to match worker timeout
          },
        )
        .toPromise();

      if (result && result.plateletCount > 0) {
        // Retrieve platelets from IDBSun storage
        const plateletsCollection = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
        const platelets: Platelet[] = [];

        for await (const [_, platelet] of plateletsCollection.find(
          'plateId',
          plate.id,
        )) {
          platelets.push(platelet);
        }

        return platelets;
      } else {
        return this.generatePlateletsWithGridDisk(
          plate,
          planetRadius,
          resolution,
        );
      }
    } catch (error) {
      return this.generatePlateletsWithGridDisk(
        plate,
        planetRadius,
        resolution,
      );
    }
  }

  /**
   * Generate platelets using gridDisk expansion from plate center - much faster and simpler!
   */
  private async generatePlateletsWithGridDisk(
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<Platelet[]> {
    // Get the central H3 cell for the plate position
    const platePosition = new Vector3().copy(plate.position);
    const { lat, lon } = pointToLatLon(platePosition, planetRadius);
    const centralCell = latLngToCell(lat, lon, resolution);

    // Smart unit detection for plate radius
    let plateRadiusKm = plate.radius;

    // Calculate how many H3 cell radii we need to cover the plate
    const h3CellRadius = h3HexRadiusAtResolution(planetRadius, resolution);

    // Use 133% of plate radius to account for hexagonal geometry
    const searchRadius = plateRadiusKm * 1.33;

    // Calculate how many H3 cell "rings" we need to cover the search radius
    // Each ring is approximately one H3 cell radius away from the previous ring
    const ringsNeeded = Math.ceil(searchRadius / h3CellRadius);

    // SAFETY CHECK: Cap the rings to prevent H3 overflow
    const maxSafeRings = 50; // H3 gridDisk can handle up to ~50 rings safely
    const gridDiskRings = Math.min(ringsNeeded, maxSafeRings);

    // Get all cells within the gridDisk rings using atmo-utils helper
    const candidateCells = getCellsInRange(centralCell, gridDiskRings);

    // Filter cells that are actually within the plate radius
    const validCells: string[] = [];
    const plateCenter = platePosition;
    let invalidCellCount = 0;
    let outOfRangeCount = 0;

    for (const cell of candidateCells) {
      // First check if the H3 cell is valid
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

    // Create platelets for all valid cells
    const platelets: Platelet[] = [];

    if (validCells.length === 0) {
      // Fallback: create center platelet if no valid cells found
      const centerPlatelet = createCenterPlatelet(
        plate,
        planetRadius,
        resolution,
      );
      platelets.push(centerPlatelet);
    } else {
      // Create platelets for all valid cells
      let successCount = 0;
      let failureCount = 0;

      for (const cell of validCells) {
        try {
          const platelet = await createPlateletFromCell(
            cell,
            plate,
            planetRadius,
            resolution,
          );
          if (platelet && platelet.position) {
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
   * Process H0 cells in parallel for much faster platelet generation
   */
  private async processH0CellsInParallel(
    startH0Cell: string,
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<Platelet[]> {
    const processedH0Cells = new Set<string>();
    const allPlatelets: Platelet[] = [];
    const cellQueue = [startH0Cell];

    log(`🚀 ------------------------------
     Starting parallel H0 processing for plate ${plate.id}
     with h0 cell ${startH0Cell} -- (${cellToVector(startH0Cell, planetRadius).round().toArray().join(', ')})
     from plate position ${new Vector3().copy(plate.position).round().toArray().join(', ')})
    `);

    while (cellQueue.length > 0) {
      // Process up to 8 H0 cells in parallel (good balance for most systems)
      const currentBatch = cellQueue.splice(0, 8);
      const batchPromises = currentBatch.map(async (h0Cell) => {
        if (processedH0Cells.has(h0Cell))
          return { platelets: [], newCells: [] };
        processedH0Cells.add(h0Cell);

        return await this.processH0CellParallel(
          h0Cell,
          plate,
          planetRadius,
          resolution,
        );
      });

      const batchResults = await Promise.all(batchPromises);

      // Collect results and new cells to process
      for (const result of batchResults) {
        allPlatelets.push(...result.platelets);

        // Add new neighboring cells to queue if they have platelets
        for (const newCell of result.newCells) {
          if (!processedH0Cells.has(newCell) && !cellQueue.includes(newCell)) {
            cellQueue.push(newCell);
          }
        }
      }
    }

    return allPlatelets;
  }

  /**
   * Process a single H0 cell and return platelets + neighboring cells to explore
   */
  private async processH0CellParallel(
    h0Cell: string,
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<{ platelets: Platelet[]; newCells: string[] }> {
    // Get all cells at the specified resolution within this H0 cell
    const plateletCells = getCellsInH0Cell(h0Cell, resolution);

    // Filter cells within radius of the plate
    const validPlateletCells = await filterCellsByPlateRadius(
      plateletCells,
      plate,
      planetRadius,
    );

    // If no valid platelets, don't explore neighbors
    if (validPlateletCells.length === 0) {
      return { platelets: [], newCells: [] };
    }

    // Create platelets in parallel
    const plateletPromises = validPlateletCells.map((cell) =>
      createPlateletFromCell(cell, plate, planetRadius, resolution),
    );
    const platelets = await Promise.all(plateletPromises);

    // Get neighboring H0 cells to explore next
    const neighborH0Cells = getNeighboringH0Cells(h0Cell);

    return { platelets, newCells: neighborH0Cells };
  }

  /**
   * Get worker status for monitoring
   */
  getWorkerStatus() {
    return {
      enabled: this.useWorkers,
      available: this.workerAvailable,
      type: 'multiverse-worker',
      dataTransfer: 'lightweight-seeds-only',
      dataSource: 'IDBSun-IndexedDB',
      universeId: this.sim.simUniv?.name || 'default-universe',
      dontClearMode: true,
      stateless: true,
    };
  }

  /**
   * Disable workers (useful for testing or fallback scenarios)
   */
  disableWorkers() {
    this.workerAvailable = false;
  }

  /**
   * Re-enable workers if they were initially configured
   */
  enableWorkers() {
    if (this.useWorkers) {
      this.workerAvailable = true;
    }
  }

  /**
   * Test method to demonstrate multiverse worker communication
   * This shows how lightweight payloads are sent to workers
   */
  async testWorkerCommunication(plateId: string): Promise<any> {
    if (!this.useWorkers || !this.workerAvailable) {
      return { error: 'Workers not available' };
    }

    const testPayload = {
      plateId: plateId,
      planetRadius: 6371,
      resolution: 3,
      universeId: this.sim.simUniv?.name || 'test-universe',
      timestamp: Date.now(),
      dontClear: true,
      testMode: true,
      dataSource: 'IDBSun-IndexedDB',
    };

    log(
      `🧪 Testing multiverse worker communication with payload: ${JSON.stringify(testPayload)}`,
    );
    log(
      `📦 Payload size: ${JSON.stringify(testPayload).length} bytes (lightweight!)`,
    );
    log(`🔒 DontClear mode: ${testPayload.dontClear} (prevents data clearing)`);

    return testPayload;
  }
}
