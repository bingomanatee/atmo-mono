import {
  AsyncSunIF,
  memoryAsyncSunF,
  SchemaLocalIF,
} from '@wonderlandlabs/multiverse';
import { log } from '../../utils/utils';
import { DexieSun } from './DexieSun';
import { IDBSun } from './IDBSun';
import { SharedDexieSun } from './SharedDexieSun';
import { VersionedDexieSun } from './VersionedDexieSun';

interface SunFactoryOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>;
}

interface SharedSunFactoryOptions extends SunFactoryOptions {
  allSchemas: Record<string, SchemaLocalIF<any>>; // All table schemas for shared database
}

interface VersionedSunFactoryOptions extends SunFactoryOptions {
  version?: number; // Database version for this table
}

interface IDBSunFactoryOptions extends SunFactoryOptions {
  isMaster?: boolean; // Flag to indicate if this is the master instance
}

/**
 * Check if IndexedDB is available in the current environment
 */
function isIndexedDBAvailable(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'indexedDB' in window &&
      window.indexedDB !== null &&
      window.indexedDB !== undefined
    );
  } catch {
    return false;
  }
}

/**
 * Create a SharedDexieSun for multiple simulation instances sharing one database
 * This prevents schema conflicts by managing all tables in a centralized way
 */
export async function createSharedDexieSun<T extends Record<string, any>>(
  options: SharedSunFactoryOptions,
): Promise<AsyncSunIF<T>> {
  const { dbName, tableName, schema, allSchemas } = options;

  // Check if IndexedDB is available
  if (!isIndexedDBAvailable()) {
    return memoryAsyncSunF({ schema });
  }

  log(`🔧 Creating SharedDexieSun for ${tableName}`);
  const sharedDexieSun = new SharedDexieSun<T>({
    dbName,
    tableName,
    schema,
    allSchemas,
    dontClear: false, // Clear data each run for fresh experiments
  });

  return sharedDexieSun;
}

/**
 * Create a VersionedDexieSun where each Sun only knows its own schema
 * Multiple Suns can share the same database with proper versioning
 */
export async function createVersionedDexieSun<T extends Record<string, any>>(
  options: VersionedSunFactoryOptions,
): Promise<AsyncSunIF<T>> {
  const { dbName, tableName, schema, version } = options;

  // Check if IndexedDB is available
  if (!isIndexedDBAvailable()) {
    return memoryAsyncSunF({ schema });
  }

  log(`🔧 Creating VersionedDexieSun for ${tableName} v${version || 1}`);
  const versionedDexieSun = new VersionedDexieSun<T>({
    dbName,
    tableName,
    schema,
    version,
    dontClear: false, // Clear data each run for fresh experiments
  });

  return versionedDexieSun;
}

/**
 * Create an IDBSun with master/worker support
 * Uses the lightweight 'idb' library for better multi-instance support
 */
export async function createIDBSun<T extends Record<string, any>>(
  options: IDBSunFactoryOptions,
): Promise<AsyncSunIF<T>> {
  const { dbName, tableName, schema, isMaster } = options;

  // Check if IndexedDB is available
  const indexedDBAvailable = isIndexedDBAvailable();
  log(
    `🔍 IndexedDB availability check for ${tableName}: ${indexedDBAvailable}`,
  );
  log(`🔍 Window object: ${typeof window !== 'undefined'}`);
  log(
    `🔍 IndexedDB in window: ${typeof window !== 'undefined' && 'indexedDB' in window}`,
  );
  log(
    `🔍 IndexedDB value: ${typeof window !== 'undefined' ? window.indexedDB : 'no window'}`,
  );

  if (!indexedDBAvailable) {
    const memorySun = memoryAsyncSunF({ schema });
    return memorySun;
  }

  const role = isMaster ? 'Master' : 'Worker';

  const idbSun = new IDBSun<T>({
    dbName,
    tableName,
    schema,
    isMaster,
    dontClear: false, // Clear data each run for fresh experiments
  });

  // Initialize the database
  await idbSun.init();

  log(`✅ IDBSun ${role} initialized for ${tableName} (backend: idb)`);
  return idbSun;
}

/**
 * Create a DexieSun specifically (for cases where you want to force IndexedDB)
 */
export function createDexieSun<T extends Record<string, any>>(
  options: SunFactoryOptions,
): DexieSun<T> {
  return new DexieSun<T>(options);
}

/**
 * Create a memory AsyncSun specifically (for cases where you want to force memory storage)
 */
export function createMemoryAsyncSun<T extends Record<string, any>>(
  options: SunFactoryOptions,
): AsyncSunIF<T> {
  return memoryAsyncSunF({ schema: options.schema });
}

/**
 * Get information about storage capabilities in the current environment
 */
export function getStorageCapabilities(): {
  indexedDB: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
} {
  return {
    indexedDB: isIndexedDBAvailable(),
    localStorage: typeof window !== 'undefined' && 'localStorage' in window,
    sessionStorage: typeof window !== 'undefined' && 'sessionStorage' in window,
  };
}
