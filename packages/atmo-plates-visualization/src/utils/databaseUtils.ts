/**
 * Database utilities for the visualizer
 * Handles database clearing and setup outside of atmo-plates
 */

/**
 * Clear existing tables and indexes in atmo-plates database instead of deleting the whole database
 * This prevents conflicts when other contexts have the database open
 */
export async function clearExistingAtmoPlatesDatabases(): Promise<void> {
  await clearExistingAtmoPlatesDatabase('atmo-plates');
}

/**
 * Clear existing tables and indexes in a specific database instead of deleting the whole database
 * This prevents conflicts when other contexts have the database open
 */
export async function clearExistingAtmoPlatesDatabase(
  dbName: string = 'atmo-plates',
): Promise<void> {
  try {
    console.log(`🔧 Clearing existing tables in database: ${dbName}`);

    // Open database with raw IndexedDB to check existing object stores
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        // Database doesn't exist yet, that's fine
        console.log(
          `🔧 Database ${dbName} doesn't exist yet, will be created fresh`,
        );
        resolve(request.result);
      };
    });

    const existingStores = Array.from(db.objectStoreNames);
    console.log(
      `🔧 Found existing object stores: [${existingStores.join(', ')}]`,
    );

    if (existingStores.length === 0) {
      console.log(`✅ Database ${dbName} is already clean`);
      db.close();
      return;
    }

    // Clear all existing object stores using raw IndexedDB
    for (const storeName of existingStores) {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        await new Promise<void>((resolve, reject) => {
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => reject(clearRequest.error);
        });
        console.log(`🧹 Cleared object store: ${storeName}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clear object store ${storeName}:`, error);
      }
    }

    db.close();
    console.log(`✅ Cleared all tables in database: ${dbName}`);
  } catch (error) {
    console.warn(`⚠️ Failed to clear database ${dbName}:`, error);
    // Continue anyway - the schema upgrade will handle conflicts
  }
}

/**
 * Clear all data from specified tables in a database
 */
export async function clearDatabaseTables(
  dbName: string,
  tableNames: string[],
): Promise<void> {
  try {
    // Open database with raw IndexedDB
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Clear all tables in parallel
    const clearPromises = tableNames.map(async (tableName) => {
      try {
        const transaction = db.transaction(tableName, 'readwrite');
        const store = transaction.objectStore(tableName);
        await new Promise<void>((resolve, reject) => {
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => reject(clearRequest.error);
        });
        console.log(`🧹 Cleared table: ${tableName}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clear table ${tableName}:`, error);
      }
    });

    await Promise.all(clearPromises);
    db.close();
  } catch (error) {
    console.warn(`⚠️ Failed to clear tables in ${dbName}:`, error);
  }
}
