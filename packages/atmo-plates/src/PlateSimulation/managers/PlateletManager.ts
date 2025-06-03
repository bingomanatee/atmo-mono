import {
  cellToVector,
  getCellsInRange,
  h3HexRadiusAtResolution,
  isValidCell,
  latLngToCell,
  pointToLatLon,
} from '@wonderlandlabs/atmo-utils';
import { createBrowserWorkerManager } from '@wonderlandlabs/atmo-workers';
import type { TaskManager } from '@wonderlandlabs/atmo-workers';
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
  getH0CellForPosition,
  getNeighboringH0Cells,
} from '../utils/plateletUtils';

export class PlateletManager {
  public static readonly PLATELET_CELL_LEVEL = 2; // Resolution level for platelets (level 2 = ~154km cells, good balance)

  private sim: PlateSimulationIF;
  private useWorkers: boolean = false;
  private workerAvailable: boolean = false;
  private workersReady: number = 0;
  private expectedWorkers: number = 0;
  private taskManager?: TaskManager;
  private browserWorker?: any; // BrowserWorker type

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

      // Create a custom worker manager that supports module workers
      // This extends the atmo-workers functionality to handle ES6 modules
      const workerUrl = '/platelet-worker.js';
      log('🔧 PlateletManager: Setting up worker with URL:', workerUrl);

      // Set expected workers count
      this.expectedWorkers = 1; // We're creating 1 worker
      this.workersReady = 0;

      // Create a reference to this PlateletManager for use in closures
      const plateletManager = this;

      // Create a custom window object with module worker support
      const customWindow = {
        ...window,
        Worker: class extends Worker {
          constructor(scriptURL: string | URL, options?: WorkerOptions) {
            log(
              '🏗️ PlateletManager: Creating worker with URL:',
              scriptURL,
              'options:',
              options,
            );

            // Always try to create as module worker first
            try {
              super(scriptURL, { ...options, type: 'module' });
              log(
                '✅ PlateletManager: Successfully created module worker for:',
                scriptURL,
              );
            } catch (error) {
              // Fallback to regular worker
              log(
                '⚠️ PlateletManager: Module worker failed, falling back to regular worker:',
                error,
              );
              super(scriptURL, options);
            }

            this.addEventListener('message', (event) => {
              log('📨 PlateletManager: Received message from worker:', {
                type: event.data.type,
                taskId: event.data.taskId,
                requestId: event.data.requestId,
                timestamp: event.data.timestamp,
                fullData: event.data,
              });

              // Handle worker-ready signal that BrowserWorker doesn't handle
              if (event.data.type === 'worker-ready') {
                log(
                  '🎉 PlateletManager: Worker is ready! Incrementing ready count.',
                );
                plateletManager.workersReady++;
                log(
                  `📊 PlateletManager: Workers ready: ${plateletManager.workersReady}/${plateletManager.expectedWorkers}`,
                );

                // Check if all workers are ready
                if (
                  plateletManager.workersReady >=
                  plateletManager.expectedWorkers
                ) {
                  plateletManager.workerAvailable = true;
                  log(
                    '✅ PlateletManager: ALL WORKERS CONFIRMED READY - Workers now available for tasks!',
                  );
                } else {
                  log(
                    `⏳ PlateletManager: Waiting for ${plateletManager.expectedWorkers - plateletManager.workersReady} more workers to be ready`,
                  );
                }
              }

              // Handle worker-error signal
              if (event.data.type === 'worker-error') {
                console.log(
                  '❌ PlateletManager: Worker initialization failed!',
                  event.data.error,
                  '📊 PlateletManager: Worker error details:',
                  event.data,
                );

                // Mark the system as failed - don't wait for more workers
                plateletManager.workerAvailable = false;

                // Create error to propagate to the simulation initialization
                const workerError = new Error(
                  `Worker initialization failed: ${event.data.error}`,
                );
                if (event.data.stack) {
                  workerError.stack = event.data.stack;
                }

                log(
                  '💥 PlateletManager: Worker initialization failed - system unavailable',
                );
                // Note: We can't throw here since we're in an event handler
                // The error will be detected when tasks are submitted
              }

              // Handle task progress messages
              if (event.data.type === 'task-progress') {
                log(
                  `📈 PlateletManager: Task progress - ${event.data.taskId}: ${event.data.progress}% - ${event.data.message}`,
                );
              }

              // Handle detailed worker task errors
              if (event.data.type === 'worker-task-error') {
                log(
                  '❌ PlateletManager: Worker task error details:',
                  event.data.error,
                );
              }

              // Handle unhandled worker errors
              if (event.data.type === 'worker-unhandled-error') {
                log(
                  '💥 PlateletManager: Worker unhandled error:',
                  event.data.error,
                );
              }

              // Handle unhandled promise rejections
              if (event.data.type === 'worker-unhandled-rejection') {
                log(
                  '💥 PlateletManager: Worker unhandled promise rejection:',
                  event.data.error,
                );
              }
            });

            this.addEventListener('error', (error) => {
              log('❌ PlateletManager: Worker error event:', error);
            });

            this.addEventListener('messageerror', (error) => {
              log('❌ PlateletManager: Worker message error event:', error);
            });

            log(
              '✅ PlateletManager: Event listeners set up for worker:',
              scriptURL,
            );
          }
        },
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

      const workerManager = createBrowserWorkerManager({
        name: 'platelet-manager',
        window: customWindow as unknown as Window,
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

      log('✅ PlateletManager: BrowserWorkerManager created successfully');

      this.taskManager = workerManager.taskManager;
      this.browserWorker = workerManager.browserWorker;

      log('🔗 PlateletManager: TaskManager and BrowserWorker assigned');

      // Log worker status periodically
      setTimeout(() => {
        const workerStatus = this.browserWorker?.getWorkerStatus();
        log('📊 PlateletManager: Worker status after 1 second:', workerStatus);
      }, 1000);

      setTimeout(() => {
        const workerStatus = this.browserWorker?.getWorkerStatus();
        log('📊 PlateletManager: Worker status after 3 seconds:', workerStatus);
      }, 3000);

      log('✅ PlateletManager: atmo-workers system initialized');
      log(
        '⏳ PlateletManager: Waiting for worker confirmation before marking as available...',
      );
      log(
        `📊 PlateletManager: Expected workers: ${this.expectedWorkers}, Ready workers: ${this.workersReady}`,
      );

      // Workers will be marked as available when they send worker-ready signals
      // No timeout needed - we wait for actual confirmation
    } catch (error) {
      log(`❌ Failed to initialize worker manager: ${error}`);
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

    log(
      `✅ Generated ${generatedPlatelets.length} platelets for plate ${plateId}`,
    );

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
      log('⚠️ Workers not available, falling back to sequential processing');
      return this.generatePlateletsSequentially(plateIds);
    }

    log(
      `🚀 Starting parallel platelet generation for ${plateIds.length} plates`,
    );
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
          log(
            `✅ Retrieved ${platelets.length} platelets for plate ${plateId}`,
          );
        } else {
          log(`⚠️ No platelets generated for plate ${plateId}, using fallback`);
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
      log(
        `❌ Parallel processing failed: ${error}, falling back to sequential`,
      );
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
   * Uses TaskManager and BrowserWorker for proper worker management
   */
  private async generatePlateletsWithAtmoWorkers(
    plate: SimPlateIF,
    planetRadius: number,
    resolution: number,
  ): Promise<Platelet[]> {
    if (!this.taskManager) {
      throw new Error('TaskManager not initialized');
    }

    log(`🔧 Using atmo-workers for platelet generation: plate ${plate.id}`);

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

      log(`✅ atmo-workers completed for plate ${plate.id}:`, result);

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

        log(`✅ Retrieved ${platelets.length} platelets from IDBSun storage`);
        return platelets;
      } else {
        log(`⚠️ Worker didn't generate platelets, falling back to main thread`);
        return this.generatePlateletsWithGridDisk(
          plate,
          planetRadius,
          resolution,
        );
      }
    } catch (error) {
      log(`❌ atmo-workers failed: ${error}, falling back to main thread`);
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

    // Validation check for reasonable H3 cell radius
    if (h3CellRadius < 100) {
      console.warn(
        `⚠️ H3 cell radius seems small (${h3CellRadius.toFixed(1)}km). Consider using lower resolution for larger cells.`,
      );
    }

    if (h3CellRadius < 1) {
      console.error(
        `❌ H3 cell radius is suspiciously small: ${h3CellRadius}km. This suggests a unit conversion error.`,
      );
    }

    // Use 133% of plate radius to account for hexagonal geometry
    const searchRadius = plateRadiusKm * 1.33;

    // Calculate how many H3 cell "rings" we need to cover the search radius
    // Each ring is approximately one H3 cell radius away from the previous ring
    const ringsNeeded = Math.ceil(searchRadius / h3CellRadius);

    // SAFETY CHECK: Cap the rings to prevent H3 overflow
    const maxSafeRings = 50; // H3 gridDisk can handle up to ~50 rings safely
    const gridDiskRings = Math.min(ringsNeeded, maxSafeRings);

    log(
      `   Search radius (133% of plate): ${searchRadius.toFixed(2)} (same units as plate.radius)`,
    );
    log(
      `   Rings needed: ${ringsNeeded}, using: ${gridDiskRings} rings (capped at ${maxSafeRings})`,
    );

    if (ringsNeeded > maxSafeRings) {
      console.warn(
        `⚠️ Rings needed (${ringsNeeded}) exceeds safe limit (${maxSafeRings}). This suggests unit mismatch - plate.radius might be in radians instead of km.`,
      );
    }

    // Get all cells within the gridDisk rings using atmo-utils helper
    const candidateCells = getCellsInRange(centralCell, gridDiskRings);
    console.log(`   Found ${candidateCells.length} candidate cells`);

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

    log(
      `   Filtering results: ${validCells.length} valid, ${outOfRangeCount} out of range, ${invalidCellCount} invalid cells`,
    );

    log(`   Filtered to ${validCells.length} valid cells within plate radius`);

    // Create platelets for all valid cells
    const platelets: Platelet[] = [];

    if (validCells.length === 0) {
      // Fallback: create center platelet if no valid cells found
      log(`   No valid cells found, creating center platelet fallback`);
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
          const platelet = createPlateletFromCell(
            cell,
            plate,
            planetRadius,
            resolution,
          );
          if (platelet && platelet.position) {
            platelets.push(platelet);
            successCount++;
          } else {
            log(
              `   Warning: Platelet creation failed for cell ${cell} - position is undefined`,
            );
            failureCount++;
          }
        } catch (error) {
          log(`   Warning: Error creating platelet for cell ${cell}: ${error}`);
          failureCount++;
        }
      }

      log(
        `   Platelet creation: ${successCount} successful, ${failureCount} failed`,
      );
    }

    log(`   ✅ Created ${platelets.length} platelets using gridDisk method`);

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

    log(
      `✅ Parallel processing complete: ${allPlatelets.length} platelets for plate ${plate.id}`,
    );
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
    const validPlateletCells = filterCellsByPlateRadius(
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
      Promise.resolve(
        createPlateletFromCell(cell, plate, planetRadius, resolution),
      ),
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
    log('🔧 Workers disabled for PlateletManager');
  }

  /**
   * Re-enable workers if they were initially configured
   */
  enableWorkers() {
    if (this.useWorkers) {
      this.workerAvailable = true;
      log('🔧 Workers re-enabled for PlateletManager');
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
