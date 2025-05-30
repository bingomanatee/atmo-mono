import {
  AsyncSunIF,
  SchemaLocalIF,
  memoryAsyncSunF,
} from '@wonderlandlabs/multiverse';
import { DexieSun } from './DexieSun';

interface SunFactoryOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>;
}

/**
 * Factory function to create the best available AsyncSun implementation
 * TEMPORARILY DISABLED DEXIE - Force memory storage for performance testing
 */
export async function createAsyncSun<T extends Record<string, any>>(
  options: SunFactoryOptions,
): Promise<AsyncSunIF<T>> {
  const { dbName, tableName, schema } = options;

  // TEMPORARILY FORCE MEMORY STORAGE TO TEST PERFORMANCE
  console.log(
    `🧠 FORCING memory AsyncSun for ${tableName} (Dexie disabled for testing)`,
  );
  return memoryAsyncSunF({ schema });

  // DISABLED: Check if IndexedDB is available
  // if (isIndexedDBAvailable()) {
  //   try {
  //     console.log(`🔧 Creating DexieSun for ${tableName}`);
  //     const dexieSun = new DexieSun<T>({
  //       dbName,
  //       tableName,
  //       schema,
  //     });
  //
  //     // Test if DexieSun initializes successfully
  //     // The initialization happens in the constructor, so we just return it
  //     return dexieSun;
  //   } catch (error) {
  //     console.warn(`Failed to create DexieSun for ${tableName}, falling back to memory:`, error);
  //   }
  // }

  // Fall back to memory-based AsyncSun
  // console.log(`🧠 Creating memory AsyncSun for ${tableName}`);
  // return memoryAsyncSunF({ schema });
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
