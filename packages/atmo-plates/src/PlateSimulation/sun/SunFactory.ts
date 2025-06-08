import {
  AsyncSunIF,
  memoryAsyncSunF,
  SchemaLocalIF,
} from '@wonderlandlabs/multiverse';
import { log } from '../../utils/utils';
import { IDBSun } from './IDBSun';

interface IDBSunFactoryOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>;
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
 * Create a memory AsyncSun specifically (for cases where you want to force memory storage)
 */
export function createMemoryAsyncSun<T extends Record<string, any>>(options: {
  schema: SchemaLocalIF<any>;
}): AsyncSunIF<T> {
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
