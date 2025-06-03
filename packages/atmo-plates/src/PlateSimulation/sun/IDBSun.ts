import type {
  SchemaLocalIF,
  Pair,
  SunIfAsync,
} from '@wonderlandlabs/multiverse';
import { deleteDB, IDBPDatabase, openDB } from 'idb';
import { Vector3 } from 'three';
import { log } from '../../utils/utils';

interface IDBSunOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>;
  dontClear?: boolean;
  isMaster?: boolean; // Flag to indicate if this is the master instance
}

interface SerializableVector3 {
  x: number;
  y: number;
  z: number;
  _isVector3: true;
}

/**
 * IDB-based AsyncSun with better master/worker support
 * Uses the lightweight 'idb' library instead of Dexie
 */
export class IDBSun<T extends Record<string, any>> implements SunIfAsync<T> {
  private db: IDBPDatabase | null = null;
  private tableName: string;
  private dbName: string;
  private schema: SchemaLocalIF<T>;
  private dontClear: boolean = false;
  private isMaster: boolean = false;
  private version: number = 1;
  private isInitialized: boolean = false;

  readonly isAsync = true;
  public sunType = 'IDBSun';

  constructor(options: IDBSunOptions) {
    log(`🔧 IDBSun: Constructor called for ${options.tableName}`);
    this.tableName = options.tableName;
    this.dbName = options.dbName;
    this.schema = options.schema;
    this.dontClear = !!options.dontClear;
    this.isMaster = !!options.isMaster;
  }

  /**
   * Initialize the database connection - must be called after constructor
   * Assumes database and object stores already exist
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      log(`🔧 IDBSun: Already initialized for ${this.tableName}`);
      return;
    }

    log(`🔧 IDBSun: Connecting to existing database for ${this.tableName}...`);
    await this.connectToDatabase();
    this.isInitialized = true;
    log(`✅ IDBSun: Connected to database for ${this.tableName}`);
  }

  /**
   * Connect to existing database (assumes database and object stores already exist)
   */
  private async connectToDatabase(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      // Open existing database (no upgrade needed since it should already exist)
      log(`🔧 IDBSun: Opening existing database ${this.dbName}...`);
      this.db = await openDB(this.dbName, 1);

      const role = this.isMaster ? 'Master' : 'Worker';
      log(`✅ IDBSun ${role}: Connected to ${this.dbName}.${this.tableName}`);

      // Verify object store exists
      if (!this.db.objectStoreNames.contains(this.tableName)) {
        throw new Error(
          `Object store '${this.tableName}' not found in database ${this.dbName}`,
        );
      }

      // Test database access with error handling
      try {
        const count = await this.count();
        log(`📊 IDBSun ${role}: Found ${count} existing records`);
      } catch (error) {
        log(
          `⚠️ IDBSun ${role}: Could not count records (this may be normal for new databases):`,
          error,
        );
        // Don't throw - this might be expected for new databases
      }
    } catch (error) {
      log(`❌ IDBSun connection failed for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Initialize database using IDB library
   * Master creates schema, workers connect to existing
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      // IDB library is now imported directly

      // Clear database if requested (master only)
      if (!this.dontClear && this.isMaster) {
        try {
          await deleteDB(this.dbName);
          log(`✅ Database destroyed: ${this.dbName}`);
        } catch (error) {
          log(`⚠️ Failed to destroy database ${this.dbName}:`, error);
        }
      }

      this.db = await openDB(this.dbName, this.version, {
        upgrade: (
          db: any,
          oldVersion: number,
          newVersion: number,
          transaction: any,
        ) => {
          // Object stores and indexes should already be created by initializeSharedDatabase
          // This upgrade callback will only run if the database doesn't exist yet
          log(
            `⚠️ IDBSun: Unexpected database upgrade for ${this.tableName} - object stores should already exist`,
          );
        },
        blocked: () => {
          console.error(
            `⚠️ IDBSun: Database upgrade blocked for ${this.dbName}`,
          );
        },
        blocking: () => {
          log(
            `⚠️ IDBSun: Database blocking other connections for ${this.dbName}`,
          );
        },
      });

      const role = this.isMaster ? 'Master' : 'Worker';
      console.log(
        `✅ IDBSun ${role}: Connected to ${this.dbName}.${this.tableName}`,
      );

      // Verify object store exists before testing access
      if (!this.db.objectStoreNames.contains(this.tableName)) {
        throw new Error(
          `Object store '${this.tableName}' was not created properly`,
        );
      }

      // Test database access with error handling
      try {
        const count = await this.count();
        log(`📊 IDBSun ${role}: Found ${count} existing records`);
      } catch (error) {
        log(
          `⚠️ IDBSun ${role}: Could not count records (this may be normal for new databases):`,
          error,
        );
        // Don't throw - this might be expected for new databases
      }
    } catch (error) {
      log(`❌ IDBSun initialization failed for ${this.tableName}:`, error);
      throw error;
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
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const result = await this.db.get(this.tableName, key);
    if (!result) return undefined;

    // CRITICAL FIX: Don't remove the id field! Keep the entire record including id
    return this.deserialize(result) as T;
  }

  async set(key: string, value: T): Promise<void> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    try {
      const serializedValue = this.serialize(value);
      const record = { ...serializedValue, id: key };
      await this.db.put(this.tableName, record);
    } catch (error) {
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    await this.db.delete(this.tableName, key);
  }

  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    await this.db.clear(this.tableName);
  }

  async has(key: string): Promise<boolean> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const result = await this.db.get(this.tableName, key);
    return result !== undefined;
  }

  async count(): Promise<number> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    return await this.db.count(this.tableName);
  }

  async *find(...query: any[]): AsyncGenerator<Pair<string, T>, void, unknown> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const [a, b] = query;

    if (!query.length) {
      const allRecords = await this.db.getAll(this.tableName);
      for (const record of allRecords) {
        yield this.deserialize(record) as T;
      }
    } else if (typeof a === 'string') {
      const store = this.db
        .transaction(this.tableName)
        .objectStore(this.tableName);

      try {
        const index = store.index(a);
      } catch (err) {
        console.error('cannot get ', a, 'from table', this.tableName);
        throw err;
      }
      const results = await this.db.getAllFromIndex(this.tableName, a, b);
      for (const result of results) {
        yield [result.id, this.serialize(result)];
      }
    } else if (typeof a === 'function') {
      // Fall back to full table scan with filtering
      const allRecords = await this.values();
      for (const pair of allRecords) {
        const [id, record] = pair;
        try {
          const match = a(record, id);
          if (match) {
            yield pair;
          }
        } catch (err) {
          console.warn('bad matching outcome ', err, pair);
        }
      }
    } else {
      console.error('bad query', query);
      throw new Error('cannot interpret query');
    }
  }

  async *keys(): AsyncGenerator<string, void, unknown> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const allKeys = await this.db.getAllKeys(this.tableName);
    for (const key of allKeys) {
      yield key;
    }
  }

  async *values(): AsyncGenerator<[string, T], void, unknown> {
    const store = this.db
      ?.transaction(this.tableName)
      ?.objectStore(this.tableName);
    if (!store)
      throw new Error('values: cannot get store for ' + this.tableName);
    for await (const cursor of store.iterate()) {
      const key = cursor.key;
      const value = cursor.value;
      yield [key, value];
    }
  }

  /**
   * Get information about the storage backend being used
   */
  getStorageInfo(): {
    backend: 'idb';
    dbName: string;
    tableName: string;
    role: string;
  } {
    return {
      backend: 'idb',
      dbName: this.dbName,
      tableName: this.tableName,
      role: this.isMaster ? 'master' : 'worker',
    };
  }
}
