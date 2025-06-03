import { AsyncSunIF, SchemaLocalIF } from '@wonderlandlabs/multiverse';
import Dexie from 'dexie';
import { Vector3 } from 'three';
import { log } from '../../utils/utils';

interface VersionedDexieSunOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>;
  dontClear?: boolean;
  version?: number; // Database version for this table
}

interface SerializableVector3 {
  x: number;
  y: number;
  z: number;
  _isVector3: true;
}

/**
 * Versioned DexieSun that only knows about its own schema
 * Multiple instances can share the same database with proper versioning
 */
export class VersionedDexieSun<T extends Record<string, any>>
  implements AsyncSunIF<T>
{
  private static dbInstances: Map<string, Dexie> = new Map();
  private static dbVersions: Map<string, number> = new Map();

  private db: Dexie | null = null;
  private table: Dexie.Table<T & { id: string }, string> | null = null;
  private tableName: string;
  private dbName: string;
  private schema: SchemaLocalIF<T>;
  private indexes: string[];
  private dontClear: boolean = false;
  private version: number;

  readonly isAsync = true;

  constructor(options: VersionedDexieSunOptions) {
    this.tableName = options.tableName;
    this.dbName = options.dbName;
    this.schema = options.schema;
    this.dontClear = options.dontClear || false;
    this.version = options.version || 1;

    // Extract indexed fields from schema
    this.indexes = this.extractIndexedFields();

    this.initializeDatabase();
  }

  /**
   * Extract fields marked with index: true from the schema
   */
  private extractIndexedFields(): string[] {
    const indexedFields: string[] = [];

    for (const [fieldName, field] of Object.entries(this.schema.fields)) {
      if (field.meta?.index === true) {
        indexedFields.push(fieldName);
      }
    }

    return indexedFields;
  }

  /**
   * Initialize database with proper versioning
   * Multiple tables can be added to the same database incrementally
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      // Clear database if requested
      if (!this.dontClear) {
        log(
          `🔧 VersionedDexieSun: Destroying existing database (dontClear=false)`,
        );
        await this.destroyExistingDatabase();
      }

      // Get or create shared database instance
      let db = VersionedDexieSun.dbInstances.get(this.dbName);
      let currentVersion = VersionedDexieSun.dbVersions.get(this.dbName) || 0;

      if (!db) {
        // Create new database
        db = new Dexie(this.dbName);
        VersionedDexieSun.dbInstances.set(this.dbName, db);
      }

      // Check if we need to add this table to the database
      const newVersion = Math.max(currentVersion, this.version);

      if (newVersion > currentVersion) {
        // Add this table to the database schema
        const indexString = ['id', ...this.indexes].join(',');

        log(
          `🔧 VersionedDexieSun: Adding table ${this.tableName} v${newVersion} with indexes: ${indexString}`,
        );

        // Get existing stores from previous versions
        const existingStores: Record<string, string> = {};

        // Add this table to the stores
        existingStores[this.tableName] = indexString;

        // Set up the new version
        db.version(newVersion).stores(existingStores);

        // Update version tracking
        VersionedDexieSun.dbVersions.set(this.dbName, newVersion);
      }

      // Open database and get table reference
      await db.open();
      this.db = db;
      this.table = db.table(this.tableName);

      // Test table access
      await this.table.count();

      log(
        `✅ VersionedDexieSun initialized: ${this.dbName}.${this.tableName} v${newVersion}`,
      );
    } catch (error) {
      log(
        `❌ VersionedDexieSun initialization failed for ${this.tableName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Destroy existing database
   */
  private async destroyExistingDatabase(): Promise<void> {
    try {
      const databases = await indexedDB.databases();
      const existingDb = databases.find((db) => db.name === this.dbName);

      if (existingDb) {
        log(`🗑️ Destroying existing database: ${this.dbName}`);

        // Clear static tracking
        VersionedDexieSun.dbInstances.delete(this.dbName);
        VersionedDexieSun.dbVersions.delete(this.dbName);

        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(this.dbName);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => {
            log(`⚠️ Database deletion blocked: ${this.dbName}`);
            resolve(); // Continue anyway
          };
        });

        log(`✅ Database destroyed: ${this.dbName}`);
      }
    } catch (error) {
      log(`⚠️ Failed to destroy existing database ${this.dbName}:`, error);
    }
  }

  /**
   * Serialize data for storage (handle Vector3 objects)
   */
  private serialize(data: any): any {
    if (data instanceof Vector3) {
      return {
        x: data.x,
        y: data.y,
        z: data.z,
        _isVector3: true,
      } as SerializableVector3;
    }

    if (typeof data === 'object' && data !== null) {
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serialize(value);
      }
      return serialized;
    }

    return data;
  }

  /**
   * Deserialize data from storage (restore Vector3 objects)
   */
  private deserialize(data: any): any {
    if (data && typeof data === 'object' && data._isVector3) {
      return new Vector3(data.x, data.y, data.z);
    }

    if (typeof data === 'object' && data !== null) {
      const deserialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        deserialized[key] = this.deserialize(value);
      }
      return deserialized;
    }

    return data;
  }

  async get(key: string): Promise<T | undefined> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    const result = await this.table.get(key);
    if (!result) return undefined;

    const { id, ...data } = result;
    return this.deserialize(data) as T;
  }

  async set(key: string, value: T): Promise<void> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    const serializedValue = this.serialize(value);
    const record = { ...serializedValue, id: key };
    await this.table.put(record);
  }

  async delete(key: string): Promise<void> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    await this.table.delete(key);
  }

  async clear(): Promise<void> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    await this.table.clear();
  }

  async has(key: string): Promise<boolean> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    const result = await this.table.get(key);
    return result !== undefined;
  }

  async count(): Promise<number> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    return await this.table.count();
  }

  async *find(query?: any): AsyncGenerator<T, void, unknown> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    let collection;

    if (!query) {
      collection = this.table.toCollection();
    } else if (typeof query === 'string') {
      const item = await this.table.get(query);
      if (item) {
        const { id, ...data } = item;
        yield this.deserialize(data) as T;
      }
      return;
    } else {
      // Object query - use filter for client-side matching
      collection = this.table.toCollection().filter((item: any) => {
        return Object.entries(query).every(([key, expectedValue]) => {
          return item[key] === expectedValue;
        });
      });
    }

    for await (const item of collection) {
      const { id, ...data } = item;
      yield this.deserialize(data) as T;
    }
  }

  async *keys(): AsyncGenerator<string, void, unknown> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    for await (const item of this.table.toCollection()) {
      yield item.id;
    }
  }

  async *values(): AsyncGenerator<T, void, unknown> {
    yield* this.find();
  }

  async *entries(): AsyncGenerator<[string, T], void, unknown> {
    if (!this.table) {
      throw new Error(
        `VersionedDexieSun not ready for table ${this.tableName}`,
      );
    }

    for await (const item of this.table.toCollection()) {
      const { id, ...data } = item;
      yield [id, this.deserialize(data) as T];
    }
  }

  /**
   * Get information about the storage backend being used
   */
  getStorageInfo(): {
    backend: 'versioned-indexeddb';
    dbName: string;
    tableName: string;
    version: number;
  } {
    return {
      backend: 'versioned-indexeddb',
      dbName: this.dbName,
      tableName: this.tableName,
      version: this.version,
    };
  }
}
