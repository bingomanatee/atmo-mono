import { asError, EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import { log } from './utils/utils';
import { openDB, deleteDB } from 'idb';
import {
  CollAsync,
  FIELD_TYPES,
  Multiverse,
  SchemaLocal,
  SchemaLocalIF,
  Universe,
} from '@wonderlandlabs/multiverse';
import type { Vector3Like } from 'three';
import { Vector3 } from 'three';
import { COLLECTIONS } from './PlateSimulation/constants';
import {
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

// Database clearing functions have been moved to the application level
// atmo-plates now only lazy-creates tables/databases as needed

/**
 * Extract fields marked with index: true from the schema
 */
function extractIndexedFields(schema: SchemaLocalIF<any>): string[] {
  const indexedFields: string[] = [];

  console.log(`🔍 Extracting indexes from schema:`, schema.name);
  console.log(`🔍 Schema fields:`, Object.keys(schema.fields));

  for (const [fieldName, field] of Object.entries(schema.fields)) {
    console.log(`🔍 Field ${fieldName}:`, field);
    console.log(`🔍 Field ${fieldName} meta:`, field.meta);
    console.log(`🔍 Field ${fieldName} index:`, field.meta?.index);

    if (field.meta?.index === true) {
      indexedFields.push(fieldName);
      console.log(`✅ Added index for field: ${fieldName}`);
    }
  }

  console.log(`🔍 Final indexed fields:`, indexedFields);
  return indexedFields;
}

/**
 * Initialize the shared database with all required object stores and indexes
 * This prevents race conditions when multiple IDBSuns try to initialize simultaneously
 */
async function initializeSharedDatabase(
  dbName: string,
  schemas: Record<string, SchemaLocalIF<any>>,
  skipDeletion: boolean = false,
): Promise<void> {
  try {
    if (!skipDeletion) {
      // Only clear databases if explicitly requested
      await clearExistingAtmoPlatesDatabases();
    }

    // Create database with all object stores and indexes
    const db = await openDB(dbName, 1, {
      upgrade: (db, oldVersion, newVersion, transaction) => {
        console.log(`🔧 Database upgrade: ${oldVersion} → ${newVersion}`);
        console.log(`🔧 Schemas to process:`, Object.keys(schemas));

        // Create all object stores with their indexes
        for (const [tableName, schema] of Object.entries(schemas)) {
          console.log(`🔧 Processing table: ${tableName}`);
          console.log(`🔧 Schema for ${tableName}:`, schema);

          if (!db.objectStoreNames.contains(tableName)) {
            const store = db.createObjectStore(tableName, {
              keyPath: 'id',
            });

            // Create indexes for this table
            const indexes = extractIndexedFields(schema);
            console.log(`🔧 Extracted indexes for ${tableName}:`, indexes);

            for (const indexName of indexes) {
              store.createIndex(indexName, indexName);
              console.log(
                `🔧 Created index: ${indexName} for table: ${tableName}`,
              );
            }

            console.log(
              `🔧 Created object store ${tableName} with indexes: [${indexes.join(', ')}]`,
            );
          } else {
            console.log(
              `🔧 Object store ${tableName} already exists, skipping`,
            );
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
    // Use IDBSun for shared data storage
    const dbName = 'atmo-plates';
    const isMaster = true; // Main thread is the master

    // Initialize the database once for all collections with their schemas
    // Skip database deletion for shared storage to avoid conflicts
    await initializeSharedDatabase(
      dbName,
      {
        [COLLECTIONS.PLATES]: platesSchema,
        [COLLECTIONS.PLANETS]: planetsSchema,
        [COLLECTIONS.SIMULATIONS]: simulationsSchema,
        [COLLECTIONS.STEPS]: plateStepsSchema,
        [COLLECTIONS.PLATELET_STEPS]: plateletStepsSchema,
        [COLLECTIONS.PLATELETS]: plateletsSchema,
      },
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

    console.log('🌌 Created shared multiverse with IDBSun storage');
  } else {
    // Use separate IDBSun instances
    platesSun = await createIDBSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLATES,
      schema: platesSchema,
      isMaster: true,
    });

    planetsSun = await createIDBSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLANETS,
      schema: planetsSchema,
      isMaster: true,
    });

    simulationsSun = await createIDBSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.SIMULATIONS,
      schema: simulationsSchema,
      isMaster: true,
    });

    plateStepsSun = await createIDBSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.STEPS,
      schema: plateStepsSchema,
      isMaster: true,
    });

    plateletStepsSun = await createIDBSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLATELET_STEPS,
      schema: plateletStepsSchema,
      isMaster: true,
    });

    plateletsSun = await createIDBSun({
      dbName: 'atmo-plates',
      tableName: COLLECTIONS.PLATELETS,
      schema: plateletsSchema,
      isMaster: true,
    });

    log('🔧 Created multiverse with separate IDBSun storage');
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
