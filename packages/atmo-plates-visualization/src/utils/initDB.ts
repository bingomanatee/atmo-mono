import { openDB, type IDBPDatabase } from 'idb';
import type { SchemaLocalIF } from '@wonderlandlabs/atmo-plates/src/schema'; // Adjust path as needed

export async function initDBConnection(
  dbName: string,
  schemas: Record<string, SchemaLocalIF<any>>,
): Promise<IDBPDatabase> {
  let currentVersion = 0;

  // Try to get current DB version, handle if DB doesn't exist yet
  try {
    currentVersion = await new Promise<number>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        const version = db.version;
        db.close();
        resolve(version);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        console.warn(`Blocked while trying to open DB ${dbName} to get version`);
      };
    });
  } catch (error) {
    // Database does not exist yet, treat version as 0
    currentVersion = 0;
  }

  // Open DB at current version to inspect stores and indexes if version > 0
  let needsUpgrade = false;
  if (currentVersion > 0) {
    const dbAtCurrentVersion = await openDB(dbName, currentVersion);

    for (const [storeName, schema] of Object.entries(schemas)) {
      if (!dbAtCurrentVersion.objectStoreNames.contains(storeName)) {
        needsUpgrade = true;
        break;
      }
      const tx = dbAtCurrentVersion.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const existingIndexes = Array.from(store.indexNames);

      const expectedIndexes = Object.entries(schema.fields)
        .filter(([, field]) => field.meta?.index === true)
        .map(([fieldName]) => fieldName);

      if (!expectedIndexes.every((idx) => existingIndexes.includes(idx))) {
        needsUpgrade = true;
        break;
      }

      if (!existingIndexes.every((idx) => expectedIndexes.includes(idx))) {
        needsUpgrade = true;
        break;
      }
    }

    await dbAtCurrentVersion.close();
  } else {
    // No DB exists, so we definitely need to create schema
    needsUpgrade = true;
  }

  if (!needsUpgrade) {
    // Schema matches, open and return DB
    return await openDB(dbName, currentVersion);
  }

  const newVersion = currentVersion + 1;

  const upgradedDB = await openDB(dbName, newVersion, {
    upgrade(db, oldVersion, newVersion, transaction) {
      for (const [storeName, schema] of Object.entries(schemas)) {
        let store: IDBObjectStore;
        if (!db.objectStoreNames.contains(storeName)) {
          store = db.createObjectStore(storeName, { keyPath: 'id' });
        } else {
          store = transaction.objectStore(storeName);
        }

        // Delete unwanted indexes
        for (const existingIndex of store.indexNames) {
          if (
            !Object.entries(schema.fields).some(
              ([fieldName, field]) =>
                fieldName === existingIndex && field.meta?.index === true,
            )
          ) {
            try {
              store.deleteIndex(existingIndex);
            } catch (err) {
              console.warn(
                `Failed to delete index ${existingIndex} on ${storeName}`,
                err,
              );
            }
          }
        }

        console.log('iterating over ', schema);
        // Create missing indexes
        for (const [fieldName, field] of Object.entries(schema.fields)) {
          if (
            field.meta?.index === true &&
            !store.indexNames.contains(fieldName)
          ) {
            try {
              store.createIndex(fieldName, fieldName);
            } catch (err) {
              console.warn(
                `Failed to create index ${fieldName} on ${storeName}`,
                err,
              );
            }
          }
        }
      }
    },
  });

  return upgradedDB;
}
