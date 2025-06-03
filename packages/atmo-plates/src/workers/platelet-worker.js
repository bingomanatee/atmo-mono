// Platelet Worker - Uses IDBSun for shared IndexedDB access
import { Multiverse, CollAsync, SchemaLocal } from "@wonderlandlabs/multiverse";
import { createIDBSun } from "../PlateSimulation/sun";
import { COLLECTIONS } from "../PlateSimulation/constants";
import { SIM_PLATELETS_SCHEMA, UNIVERSES } from "../schema";
import {
  cellToVector,
  getCellsInRange,
  h3HexRadiusAtResolution,
  isValidCell,
  pointToLatLon,
  latLngToCell,
} from "@wonderlandlabs/atmo-utils";
import { Vector3 } from "three";
import { createPlateletFromCell } from "../PlateSimulation/utils/plateletUtils";

// Worker state
let workerMultiverse;
let plateletsCollection;
let platesCollection;
let isInitialized = false;

// Main platelet generation handler (works for both atmo-workers and legacy formats)
async function handlePlateletGeneration({
  plateId,
  planetRadius,
  resolution,
  universeId,
  dontClear,
  timestamp,
  testMode = false,
}) {
  try {
    if (testMode) {
      // Just send back a success message for testing
      return {
        success: true,
        plateId,
        plateletCount: 0,
        message: "Test mode successful",
        timestamp: Date.now(),
        usedMultiverse: false,
        dontClearMode: dontClear,
        dataSource: "IDBSun-IndexedDB",
      };
    }

    // Initialize worker if not already initialized
    if (!isInitialized) {
      await initWorker(universeId, dontClear);
    }

    // Get the plate data
    let plate;
    if (platesCollection) {
      try {
        plate = await platesCollection.get(plateId);
      } catch (error) {
        console.warn("⚠️ Failed to get plate from collection:", error);
      }
    }

    if (!plate) {
      // Fallback: create a mock plate for testing
      console.warn(`⚠️ Plate ${plateId} not found, using fallback plate data`);
      plate = {
        id: plateId,
        position: { x: planetRadius, y: 0, z: 0 }, // Default position
        radius: 1000, // Default 1000km radius
        plateId: plateId,
      };
    }

    // Generate platelets
    const platelets = await generatePlatelets(plate, planetRadius, resolution);

    // Return success result
    return {
      success: true,
      plateId,
      plateletCount: platelets.length,
      plateletIds: platelets.map((p) => p.id),
      message: `Generated ${platelets.length} platelets for plate ${plateId}`,
      timestamp: Date.now(),
      usedMultiverse: true,
      dontClearMode: dontClear,
      dataSource: "IDBSun-IndexedDB",
      cellsProcessed: platelets.length,
      validCells: platelets.length,
    };
  } catch (error) {
    console.error("❌ Platelet Worker: Generation error", error);
    return {
      success: false,
      error: error.message,
      timestamp: Date.now(),
    };
  }
}

async function initWorker(universeId, dontClear) {
  try {
    console.log("🤖 Platelet Worker: Initializing worker");

    // Create multiverse
    workerMultiverse = new Multiverse();

    // Create schemas
    const plateletsSchema = new SchemaLocal(
      COLLECTIONS.PLATELETS,
      SIM_PLATELETS_SCHEMA
    );

    // Create IDBSun for worker (connects to existing schema)
    const plateletsSun = await createIDBSun({
      dbName: "atmo-plates",
      tableName: COLLECTIONS.PLATELETS,
      schema: plateletsSchema,
      isMaster: false, // Worker connects to existing schema
      dontClear,
    });

    // Create universe and collections
    const universe = workerMultiverse.add({
      name: universeId || UNIVERSES.SIM,
    });

    plateletsCollection = new CollAsync({
      name: COLLECTIONS.PLATELETS,
      universe,
      schema: plateletsSchema,
      sun: plateletsSun,
    });

    // Also connect to plates collection to get plate data
    // Use a more flexible schema for plates since we only need to read data
    const platesSchema = new SchemaLocal(COLLECTIONS.PLATES, {
      id: { type: "string" },
      position: { type: "object" },
      radius: { type: "number" },
      plateId: { type: "string" },
    });

    try {
      const platesSun = await createIDBSun({
        dbName: "atmo-plates",
        tableName: COLLECTIONS.PLATES,
        schema: platesSchema,
        isMaster: false,
        dontClear,
      });

      platesCollection = new CollAsync({
        name: COLLECTIONS.PLATES,
        universe,
        schema: platesSchema,
        sun: platesSun,
      });

      console.log("✅ Platelet Worker: Connected to plates collection");
    } catch (error) {
      console.warn(
        "⚠️ Platelet Worker: Failed to connect to plates collection:",
        error
      );
      // Continue without plates collection - we'll handle this in the generation function
    }

    universe.add(plateletsCollection);
    if (platesCollection) {
      universe.add(platesCollection);
    }

    isInitialized = true;
    console.log("✅ Platelet Worker: Initialized successfully");
  } catch (error) {
    console.error("❌ Platelet Worker: Initialization failed", error);
    throw error;
  }
}

async function generatePlatelets(plate, planetRadius, resolution) {
  console.log("🤖 Platelet Worker: Generating platelets for plate", plate.id);

  // Get the central H3 cell for the plate position
  const platePosition = new Vector3(
    plate.position.x,
    plate.position.y,
    plate.position.z
  );
  const { lat, lon } = pointToLatLon(platePosition, planetRadius);
  const centralCell = latLngToCell(lat, lon, resolution);

  console.log("   Central H3 cell:", centralCell);
  console.log("   Plate radius:", plate.radius, "km");

  // Calculate how many H3 cell radii we need to cover the plate
  const h3CellRadius = h3HexRadiusAtResolution(planetRadius, resolution);
  console.log(
    "   H3 cell radius at resolution",
    resolution,
    ":",
    h3CellRadius,
    "km"
  );

  // Use 133% of plate radius to account for hexagonal geometry
  const searchRadius = plate.radius * 1.33;

  // Calculate how many H3 cell "rings" we need to cover the search radius
  const ringsNeeded = Math.ceil(searchRadius / h3CellRadius);
  const gridDiskRings = ringsNeeded;

  console.log(
    "   Search radius (133% of plate):",
    searchRadius.toFixed(2),
    "km"
  );
  console.log(
    "   Rings needed:",
    ringsNeeded,
    ", using:",
    gridDiskRings,
    "rings (no cap)"
  );

  // Get all cells within the gridDisk rings
  const candidateCells = getCellsInRange(centralCell, gridDiskRings);
  console.log("   Found", candidateCells.length, "candidate cells");

  // Filter cells that are actually within the plate radius
  const validCells = [];
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

      if (distanceToPlate <= plate.radius) {
        validCells.push(cell);
      } else {
        outOfRangeCount++;
      }
    } catch (error) {
      invalidCellCount++;
    }
  }

  console.log(
    "   Filtering results:",
    validCells.length,
    "valid,",
    outOfRangeCount,
    "out of range,",
    invalidCellCount,
    "invalid cells"
  );

  // Create platelets for all valid cells
  const platelets = [];
  let successCount = 0;
  let failureCount = 0;

  for (const cell of validCells) {
    try {
      const platelet = createPlateletFromCell(
        cell,
        plate,
        planetRadius,
        resolution
      );
      if (platelet && platelet.position) {
        // Store the platelet in the collection
        await plateletsCollection.set(platelet.id, platelet);
        platelets.push(platelet);
        successCount++;
      } else {
        console.log(
          "   Warning: Platelet creation failed for cell",
          cell,
          "- position is undefined"
        );
        failureCount++;
      }
    } catch (error) {
      console.log(
        "   Warning: Error creating platelet for cell",
        cell,
        ":",
        error
      );
      failureCount++;
    }
  }

  console.log(
    "   Platelet creation:",
    successCount,
    "successful,",
    failureCount,
    "failed"
  );
  console.log(
    "   ✅ Created",
    platelets.length,
    "platelets using gridDisk method"
  );

  return platelets;
}

// Export functions for use as imports
export { handlePlateletGeneration, initWorker, generatePlatelets };

// Export a main function that sets up the worker message handler
export function setupPlateletWorker() {
  // Worker message handler for atmo-workers system
  self.onmessage = async function (e) {
    try {
      // Handle atmo-workers format
      if (
        e.data.type === "execute-task" &&
        e.data.taskId === "generate-platelets"
      ) {
        const {
          parameters: {
            plateId,
            planetRadius,
            resolution,
            universeId,
            dontClear,
          },
          requestId,
          timestamp,
        } = e.data;

        console.log("🤖 Platelet Worker: Received atmo-workers task", e.data);

        // Process the task
        const result = await handlePlateletGeneration({
          plateId,
          planetRadius,
          resolution,
          universeId,
          dontClear,
          timestamp,
        });

        // Send response in atmo-workers format
        self.postMessage({
          type: "task-complete",
          taskId: "generate-platelets",
          requestId: requestId,
          success: result.success,
          result: result.success ? result : undefined,
          error: result.success ? undefined : result.error,
          timestamp: Date.now(),
        });

        return;
      }

      // Legacy format support (for backward compatibility)
      const {
        plateId,
        planetRadius,
        resolution,
        universeId,
        dontClear,
        timestamp,
        testMode,
      } = e.data;

      console.log("🤖 Platelet Worker: Received message", e.data);

      // Handle legacy format
      const result = await handlePlateletGeneration({
        plateId,
        planetRadius,
        resolution,
        universeId,
        dontClear,
        timestamp,
        testMode,
      });

      // Send legacy format response
      self.postMessage(result);
    } catch (error) {
      console.error("❌ Platelet Worker: Error", error);
      self.postMessage({
        success: false,
        error: error.message,
        timestamp: Date.now(),
      });
    }
  };

  console.log("🤖 Platelet Worker: Script loaded and ready");
}

// Auto-setup when running as a worker script
if (typeof self !== "undefined" && typeof window === "undefined") {
  setupPlateletWorker();
}
