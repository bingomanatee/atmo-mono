import type {
  SchemaLocalIF,
  Pair,
  SunIfAsync,
} from '@wonderlandlabs/multiverse';
import { FIELD_TYPES } from '@wonderlandlabs/multiverse';
import type { MutationAction } from '@wonderlandlabs/multiverse/dist';
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
export class IDBSun<RecordType extends Record<string, any>, K extends KeyType>
  implements SunIfAsync<RecordType>
{
  private db: IDBPDatabase | null = null;
  private tableName: string;
  private dbName: string;
  private schema: SchemaLocalIF<RecordType>;
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

      // Database clearing is now handled externally by the application
      // IDBSun only lazy-creates tables/databases as needed

      this.db = await openDB(this.dbName, this.version, {
        upgrade: (
          db: any,
          oldVersion: number,
          newVersion: number,
          transaction: any,
        ) => {
          // Object stores and indexes should already be created by initializeSharedDatabase
          // This upgrade callback will only run if the database doesn't exist yet
          console.warn(
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

      // Verify object store exists before testing access
      if (!this.db.objectStoreNames.contains(this.tableName)) {
        throw new Error(
          `Object store '${this.tableName}' was not created properly`,
        );
      }
    } catch (error) {
      log(`❌ IDBSun initialization failed for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Serialize a specific field using schema definitions
   */
  private serializeField(data: any, fieldName: string): any {
    if (data === null || data === undefined) {
      return data;
    }

    const field = this.schema?.fields?.[fieldName];
    if (!field) {
      return this.serialize(data);
    }

    // Handle different field types using FIELD_TYPES
    switch (field.type) {
      case FIELD_TYPES.object:
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          // Handle Vector3 objects
          if (data instanceof Vector3) {
            return {
              x: data.x,
              y: data.y,
              z: data.z,
            };
          }

          // Otherwise serialize all properties
          return data;
        }
        break;

      case FIELD_TYPES.array:
        if (Array.isArray(data)) {
          return data;
        } else {
          return [];
        }
        break;
    }

    return data;
  }

  /**
   * Generic serialize for data without specific field context
   */
  private serialize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (data instanceof Vector3) {
      return {
        x: data.x,
        y: data.y,
        z: data.z,
      };
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.serialize(item));
    }

    if (typeof data === 'object' && data !== null) {
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Try field-specific serialization if we have schema info
        if (this.schema?.fields?.[key]) {
          serialized[key] = this.serializeField(value, key);
        } else {
          serialized[key] = this.serialize(value);
        }
      }
      return serialized;
    }

    return data;
  }

  /**
   * Deserialize a specific field using schema definitions
   */
  private deserializeField(data: any, fieldName: string): any {
    if (data === null || data === undefined) {
      return data;
    }

    const field = this.schema?.fields?.[fieldName];
    if (!field) {
      return data;
    }

    // Use custom import function if available
    if (field.import && typeof field.import === 'function') {
      try {
        return field.import({
          inputRecord: data,
          field,
          schema: this.schema,
          key: fieldName,
        });
      } catch (error) {
        console.warn(`Error in custom import for field ${fieldName}:`, error);
        // Fall through to default handling
      }
    }

    // Handle different field types using FIELD_TYPES
    switch (field.type) {
      case FIELD_TYPES.object:
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          // Check for Vector3 meta hint
          if (
            field.meta?.isVector3 &&
            typeof data === 'object' &&
            'x' in data &&
            'y' in data &&
            'z' in data
          ) {
            return new Vector3(data.x, data.y, data.z);
          }

          // If field has univFields mapping, reconstruct nested object
          if (field.univFields && typeof field.univFields === 'object') {
            const reconstructed: any = {};
            for (const [localKey, universalKey] of Object.entries(
              field.univFields,
            )) {
              if (data.hasOwnProperty(universalKey)) {
                reconstructed[localKey] = this.deserialize(data[universalKey]);
              }
            }
            return reconstructed;
          }
          // Otherwise deserialize all properties
          return this.deserialize(data);
        }
        break;

      case FIELD_TYPES.array:
        if (Array.isArray(data)) {
          return Array.from(data);
        }
        break;
    }

    // Fall back to generic deserialization
    return this.deserialize(data);
  }

  /**
   * Generic deserialize for data without specific field context
   */
  private deserialize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.deserialize(item));
    }

    if (typeof data === 'object' && data !== null) {
      const deserialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Try field-specific deserialization if we have schema info
        deserialized[key] = this.schema?.fields?.[key]
          ? this.deserializeField(value, key)
          : this.deserialize(value);
      }
      return deserialized;
    }

    return data;
  }

  async get(key: string): Promise<RecordType | undefined> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const result = await this.db.get(this.tableName, key);
    if (!result) return undefined;

    let deserialized = this.deserialize(result) as RecordType;

    if (
      this.schema?.filterRecord &&
      typeof this.schema.filterRecord === 'function'
    ) {
      try {
        deserialized = this.schema.filterRecord({
          inputRecord: deserialized,
          schema: this.schema,
          key,
        });
      } catch (error) {
        console.warn(`Error in schema filterRecord for key ${key}:`, error);
        // Continue with unfiltered result
      }
    }

    return deserialized;
  }

  async set(key: string, value: RecordType): Promise<void> {
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

  async *find(
    ...query: any[]
  ): AsyncGenerator<Pair<string, RecordType>, void, unknown> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const [a, b] = query;

    if (!query.length) {
      const allRecords = await this.db.getAll(this.tableName);
      for (const record of allRecords) {
        yield this.deserialize(record) as RecordType;
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

  async *values(): AsyncGenerator<[string, RecordType], void, unknown> {
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

  async mutate(key: K, fn: MutationAction) {
    const record = await this.get(key);
    if (!record) return;
    const update = fn(record);
    if (update) {
      await this.set(key, update);
    }

    return update;
  }
}
