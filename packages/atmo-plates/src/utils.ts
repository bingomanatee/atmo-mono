import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import { log } from './utils/utils';
import { openDB, deleteDB } from 'idb';
import {
  CollAsync,
  FIELD_TYPES,
  Multiverse,
  SchemaLocal,
  Universe,
} from '@wonderlandlabs/multiverse';
import type { Vector3Like } from 'three';
import { Vector3 } from 'three';
import { COLLECTIONS } from './PlateSimulation/constants';
import {
  createAsyncSun,
  createSharedDexieSun,
  createIDBSun,
  getStorageCapabilities,
} from './PlateSimulation/sun';
import { Plate } from './PlateSimulation/Plate';
import { Platelet } from './PlateSimulation/Platelet';
import {
  SIM_PLANETS_SCHEMA,
  SIM_PLATE_STEPS_SCHEMA,
  SIM_PLATELET_STEPS_SCHEMA,
  SIM_PLATELETS_SCHEMA,
  SIM_PLATES_SCHEMA,
  SIM_SIMULATIONS_SCHEMA,
  UNIVERSES,
} from './schema';

export function coord(prefix = '') {
  return {
    [`${prefix}x`]: FIELD_TYPES.number,
    [`${prefix}y`]: FIELD_TYPES.number,
    [`${prefix}z`]: FIELD_TYPES.number,
  };
}

export function asCoord(prefix: string, p: Vector3Like = new Vector3()) {
  return {
    [`${prefix}x`]: p.x,
    [`${prefix}y`]: p.y,
    [`${prefix}z`]: p.z,
  };
}

/**
 * Request persistent storage to prevent browser from clearing data
 */
async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try {
      const isPersistent = await navigator.storage.persist();
      return isPersistent;
    } catch (error) {
      return false;
    }
  } else {
    return false;
  }
}

/**
 * Force close all IndexedDB connections to prepare for database deletion
 */
async function forceCloseAllConnections(): Promise<void> {
  // Close any global database connections that might be open
  if (typeof window !== 'undefined' && (window as any).__dbConnections) {
    const connections = (window as any).__dbConnections;
    for (const [dbName, db] of Object.entries(connections)) {
      try {
        (db as any).close();
        delete connections[dbName];
      } catch (error) {
        // Ignore errors during connection closing
      }
    }
  }

  // Give connections time to close
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Clear any existing atmo-plates databases to prevent conflicts
 */
export async function clearExistingAtmoPlatesDatabases(): Promise<void> {
  // First, force close all existing connections
  await forceCloseAllConnections();

  // Get all databases
  const databases = await indexedDB.databases();

  // Filter atmo-plates related databases
  const databasesToDelete = databases.filter(
    (db) =>
      db.name && (db.name.includes('atmo-plates') || db.name === 'atmo-plates'),
  );

  if (databasesToDelete.length === 0) {
    return;
  }

  // Delete all databases in parallel
  const deletionPromises = databasesToDelete.map((db) => {
    return new Promise<void>((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(db.name!);
      let isResolved = false;

      // Single timeout that throws failure after 10 seconds
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(
            new Error(
              `Database deletion timeout for ${db.name} after 10 seconds`,
            ),
          );
        }
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeoutId);
      };

      deleteReq.onsuccess = () => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve();
        }
      };

      deleteReq.onerror = (err) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(deleteReq.error);
        }
      };

      deleteReq.onblocked = () => {
        // Try to force close connections and retry
        setTimeout(async () => {
          if (!isResolved) {
            try {
              await forceCloseAllConnections();
              // The original delete request should now succeed
            } catch (error) {
              // Ignore errors during retry
            }
          }
        }, 500); // Wait 500ms then try to force close

        // Don't resolve immediately - let the timeout handle it if retry fails
      };
    });
  });

  // Wait for all deletions to complete - will throw if any fail
  await Promise.all(deletionPromises);
}

/**
 * Initialize the shared database with all required object stores
 * This prevents race conditions when multiple IDBSuns try to initialize simultaneously
 */
async function initializeSharedDatabase(
  dbName: string,
  tableNames: string[],
  skipDeletion: boolean = false,
): Promise<void> {
  try {
    if (!skipDeletion) {
      // Only clear databases if explicitly requested
      await clearExistingAtmoPlatesDatabases();
    }

    // Create database with all object stores
    const db = await openDB(dbName, 1, {
      upgrade: (db, oldVersion, newVersion, transaction) => {
        // Create all object stores
        for (const tableName of tableNames) {
          if (!db.objectStoreNames.contains(tableName)) {
            const store = db.createObjectStore(tableName, {
              keyPath: 'id',
            });
            // Note: Indexes will be added by individual IDBSuns if needed
          }
        }
      },
      blocked: () => {
        // Database upgrade blocked
      },
      blocking: () => {
        // Database blocking other connections
      },
    });

    db.close(); // Close the connection, IDBSuns will open their own
  } catch (error) {
    console.error(`❌ Failed to initialize shared database ${dbName}:`, error);
    throw error;
  }
}

export async function simUniverse(
  mv: Multiverse,
  useSharedStorage = false,
): Promise<Universe> {
  const simUniv = new Universe(UNIVERSES.SIM, mv);

  // Create schemas
  const platesSchema = new SchemaLocal(
    COLLECTIONS.PLATES,
    SIM_PLATES_SCHEMA,
    ({ inputRecord }) => {
      // Convert plain objects to Plate instances
      if (
        inputRecord &&
        typeof inputRecord === 'object' &&
        !(inputRecord instanceof Plate)
      ) {
        return Plate.fromJSON(inputRecord as any);
      }
      return inputRecord;
    },
  );

  const planetsSchema = new SchemaLocal(
    COLLECTIONS.PLANETS,
    SIM_PLANETS_SCHEMA,
  );
  const simulationsSchema = new SchemaLocal(
    COLLECTIONS.SIMULATIONS,
    SIM_SIMULATIONS_SCHEMA,
  );
  const plateStepsSchema = new SchemaLocal(
    COLLECTIONS.STEPS,
    SIM_PLATE_STEPS_SCHEMA,
  );
  const plateletStepsSchema = new SchemaLocal(
    COLLECTIONS.PLATELET_STEPS,
    SIM_PLATELET_STEPS_SCHEMA,
  );
  const plateletsSchema = new SchemaLocal(
    COLLECTIONS.PLATELETS,
    SIM_PLATELETS_SCHEMA,
    ({ inputRecord }) => {
      // Convert plain objects to Platelet instances
      if (
        inputRecord &&
        typeof inputRecord === 'object' &&
        !(inputRecord instanceof Platelet)
      ) {
        return new Platelet(inputRecord as any);
      }
      return inputRecord;
    },
  );

  // Create adaptive suns using factory - shared or separate based on flag
  let platesSun,
    planetsSun,
    simulationsSun,
    plateStepsSun,
    plateletStepsSun,
    plateletsSun;

  if (useSharedStorage) {
    // Use IDBSun for master/worker data sharing
    const dbName = 'atmo-plates';
    const isMaster = true; // Main thread is the master

    // Initialize the database once for all collections
    // Skip database deletion for shared storage to avoid conflicts
    await initializeSharedDatabase(
      dbName,
      [
        COLLECTIONS.PLATES,
        COLLECTIONS.PLANETS,
        COLLECTIONS.SIMULATIONS,
        COLLECTIONS.STEPS,
        COLLECTIONS.PLATELET_STEPS,
        COLLECTIONS.PLATELETS,
      ],
      true, // Always skip deletion for shared storage - let caller decide when to clear
    );

    platesSun = await createIDBSun({
      dbName,
      tableName: COLLECTIONS.PLATES,
      schema: platesSchema,
      isMaster,
    });

    planetsSun = await createIDBSun({
      dbName,
      tableName: COLLECTIONS.PLANETS,
      schema: planetsSchema,
      isMaster,
    });

    simulationsSun = await createIDBSun({
      dbName,
      tableName: COLLECTIONS.SIMULATIONS,
      schema: simulationsSchema,
      isMaster,
    });

    plateStepsSun = await createIDBSun({
      dbName,
      tableName: COLLECTIONS.STEPS,
      schema: plateStepsSchema,
      isMaster,
    });

    plateletStepsSun = await createIDBSun({
      dbName,
      tableName: COLLECTIONS.PLATELET_STEPS,
      schema: plateletStepsSchema,
      isMaster,
    });

    plateletsSun = await createIDBSun({
      dbName,
      tableName: COLLECTIONS.PLATELETS,
      schema: plateletsSchema,
      isMaster,
    });

    console.log(
      '🌌 Created shared multiverse with IDBSun storage for better worker support',
    );
  } else {
    // Use separate DexieSun instances (original behavior)
    platesSun = await createAsyncSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLATES,
      schema: platesSchema,
    });

    planetsSun = await createAsyncSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLANETS,
      schema: planetsSchema,
    });

    simulationsSun = await createAsyncSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.SIMULATIONS,
      schema: simulationsSchema,
    });

    plateStepsSun = await createAsyncSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.STEPS,
      schema: plateStepsSchema,
    });

    plateletStepsSun = await createAsyncSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLATELET_STEPS,
      schema: plateletStepsSchema,
    });

    plateletsSun = await createAsyncSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLATELETS,
      schema: plateletsSchema,
    });

    log('🔧 Created multiverse with separate DexieSun storage');
  }

  // Create collections with adaptive suns
  const platesCollection = new CollAsync({
    name: COLLECTIONS.PLATES,
    universe: simUniv,
    schema: platesSchema,
    sunF: () => platesSun,
  });

  const planetsCollection = new CollAsync({
    name: COLLECTIONS.PLANETS,
    universe: simUniv,
    schema: planetsSchema,
    sunF: () => planetsSun,
  });

  const simulationsCollection = new CollAsync({
    name: COLLECTIONS.SIMULATIONS,
    universe: simUniv,
    schema: simulationsSchema,
    sunF: () => simulationsSun,
  });

  const plateCollection = new CollAsync({
    name: COLLECTIONS.STEPS,
    universe: simUniv,
    schema: plateStepsSchema,
    sunF: () => plateStepsSun,
  });

  const plateletStepsCollection = new CollAsync({
    name: COLLECTIONS.PLATELET_STEPS,
    universe: simUniv,
    schema: plateletStepsSchema,
    sunF: () => plateletStepsSun,
  });

  const plateletsCollection = new CollAsync({
    name: COLLECTIONS.PLATELETS,
    universe: simUniv,
    schema: plateletsSchema,
    sunF: () => plateletsSun,
  });

  return simUniv;
}

export function varySpeedByRadius(
  earthSpeed: number,
  radiusKm: number,
): number {
  const scaleFactor = radiusKm / EARTH_RADIUS;
  const speed = earthSpeed * Math.pow(scaleFactor, 0.5);
  return Math.max(1, Math.min(speed, 20));
}
