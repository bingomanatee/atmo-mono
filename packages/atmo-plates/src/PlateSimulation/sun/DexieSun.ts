import { AsyncSunIF, SchemaLocalIF } from '@wonderlandlabs/multiverse';
import Dexie from 'dexie';
import { Vector3 } from 'three';

interface DexieSunOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>;
  dontClear?: boolean; // Prevent clearing data on initialization
}

interface SerializableVector3 {
  x: number;
  y: number;
  z: number;
  _isVector3: true;
}

/**
 * IndexedDB-backed AsyncSun using Dexie with fallback to memory storage
 */
export class DexieSun<T extends Record<string, any>> implements AsyncSunIF<T> {
  private db: Dexie | null = null;
  private table: Dexie.Table<T & { id: string }, string> | null = null;
  private tableName: string;
  private dbName: string;
  private schema: SchemaLocalIF<T>;
  private indexes: string[];
  private fallbackData: Map<string, T> = new Map();
  private isIndexedDBAvailable: boolean = false;
  private dontClear: boolean = false;

  readonly isAsync = true;

  constructor(options: DexieSunOptions) {
    this.tableName = options.tableName;
    this.dbName = options.dbName;
    this.schema = options.schema;
    this.dontClear = options.dontClear || false;

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
   * Serialize complex objects for IndexedDB storage
   */
  private serialize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (obj instanceof Vector3) {
      return {
        x: obj.x,
        y: obj.y,
        z: obj.z,
        _isVector3: true,
      } as SerializableVector3;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.serialize(item));
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
      const serialized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = this.serialize(value);
      }
      return serialized;
    }

    return obj;
  }

  /**
   * Deserialize objects from IndexedDB storage
   */
  private deserialize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'object' && obj._isVector3) {
      const vec = obj as SerializableVector3;
      return new Vector3(vec.x, vec.y, vec.z);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deserialize(item));
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
      const deserialized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        deserialized[key] = this.deserialize(value);
      }
      return deserialized;
    }

    return obj;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available, falling back to memory storage');
        this.isIndexedDBAvailable = false;
        return;
      }

      // Only destroy existing database if dontClear is false
      if (!this.dontClear) {
        console.log(
          '🔧 DexieSun: Destroying existing database (dontClear=false)',
        );
        await this.destroyExistingDatabase();
      } else {
        console.log(
          '🔒 DexieSun: Preserving existing database (dontClear=true)',
        );
      }

      // Initialize Dexie database
      this.db = new Dexie(this.dbName);

      // Create index string: 'id' + indexed fields
      const indexString = ['id', ...this.indexes].join(',');

      console.log(`🔧 Creating DexieSun with indexes: ${indexString}`);

      this.db.version(1).stores({
        [this.tableName]: indexString,
      });

      this.table = this.db.table(this.tableName);

      // Test database access
      await this.table.count();
      this.isIndexedDBAvailable = true;

      console.log(
        `✅ DexieSun initialized with IndexedDB: ${this.dbName}.${this.tableName}`,
      );
    } catch (error) {
      console.warn(
        'Failed to initialize IndexedDB, falling back to memory storage:',
        error,
      );
      this.isIndexedDBAvailable = false;
      this.db = null;
      this.table = null;
    }
  }

  /**
   * Destroy existing database to ensure clean schema setup
   */
  private async destroyExistingDatabase(): Promise<void> {
    try {
      // Check if database exists
      const databases = await indexedDB.databases();
      const existingDb = databases.find((db) => db.name === this.dbName);

      if (existingDb) {
        console.log(`🗑️ Destroying existing database: ${this.dbName}`);

        // Delete the database
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(this.dbName);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => {
            console.warn(`Database deletion blocked: ${this.dbName}`);
            // Continue anyway - the new schema will override
            resolve();
          };
        });

        console.log(`✅ Database destroyed: ${this.dbName}`);
      }
    } catch (error) {
      console.warn(
        `Failed to destroy existing database ${this.dbName}:`,
        error,
      );
      // Continue anyway - Dexie will handle schema conflicts
    }
  }

  async get(key: string): Promise<T | undefined> {
    if (!this.isIndexedDBAvailable || !this.table) {
      throw new Error(
        'DexieSun: IndexedDB not available - cannot perform get operation',
      );
    }

    const result = await this.table.get(key);
    if (!result) return undefined;

    // Remove the id property that was added for Dexie and deserialize
    const { id, ...data } = result;
    return this.deserialize(data) as T;
  }

  async set(key: string, value: T): Promise<void> {
    if (!this.isIndexedDBAvailable || !this.table) {
      throw new Error(
        'DexieSun: IndexedDB not available - cannot perform set operation',
      );
    }

    // Serialize the value and add id property for Dexie
    const serializedValue = this.serialize(value);
    const record = { ...serializedValue, id: key };
    await this.table.put(record);
  }

  async delete(key: string): Promise<void> {
    if (!this.isIndexedDBAvailable || !this.table) {
      throw new Error(
        'DexieSun: IndexedDB not available - cannot perform delete operation',
      );
    }

    await this.table.delete(key);
  }

  async clear(): Promise<void> {
    if (!this.isIndexedDBAvailable || !this.table) {
      throw new Error(
        'DexieSun: IndexedDB not available - cannot perform clear operation',
      );
    }

    await this.table.clear();
  }

  async has(key: string): Promise<boolean> {
    if (!this.isIndexedDBAvailable || !this.table) {
      throw new Error(
        'DexieSun: IndexedDB not available - cannot perform has operation',
      );
    }

    const result = await this.table.get(key);
    return result !== undefined;
  }

  async count(): Promise<number> {
    if (!this.isIndexedDBAvailable || !this.table) {
      throw new Error(
        'DexieSun: IndexedDB not available - cannot perform count operation',
      );
    }

    return await this.table.count();
  }

  async *find(query?: any): AsyncGenerator<T, void, unknown> {
    if (this.isIndexedDBAvailable && this.table) {
      try {
        let collection;

        if (!query) {
          // No query - return all items
          collection = this.table.toCollection();
        } else if (typeof query === 'string') {
          // Single key lookup
          const item = await this.table.get(query);
          if (item) {
            const { id, ...data } = item;
            yield this.deserialize(data) as T;
          }
          return;
        } else if (
          typeof query === 'object' &&
          Object.keys(query).length === 1
        ) {
          // Single property query - use indexed query if field is indexed
          const [key, value] = Object.entries(query)[0];

          if (this.indexes.includes(key)) {
            // Use fast indexed query
            collection = this.table.where(key).equals(value);
          } else {
            // Fall back to full table scan with filter
            collection = this.table.toCollection().filter((item: any) => {
              return item[key] === value;
            });
          }
        } else {
          // Complex query - use filter for client-side matching
          collection = this.table.toCollection().filter((item: any) => {
            return Object.entries(query).every(([key, expectedValue]) => {
              return item[key] === expectedValue;
            });
          });
        }

        for await (const item of collection) {
          // Remove the id property that was added for Dexie and deserialize
          const { id, ...data } = item;
          yield this.deserialize(data) as T;
        }
        return;
      } catch (error) {
        console.error('DexieSun find error, falling back to memory:', error);
        this.isIndexedDBAvailable = false;
      }
    }

    // Fallback to memory storage
    for (const value of this.fallbackData.values()) {
      if (!query) {
        yield value;
      } else if (typeof query === 'string') {
        // Single key lookup in memory
        const memValue = this.fallbackData.get(query);
        if (memValue) {
          yield memValue;
        }
        return;
      } else {
        // Object query matching - check if all query properties match
        const matches = Object.entries(query).every(([key, expectedValue]) => {
          return (value as any)[key] === expectedValue;
        });
        if (matches) {
          yield value;
        }
      }
    }
  }

  async *keys(): AsyncGenerator<string, void, unknown> {
    if (this.isIndexedDBAvailable && this.table) {
      try {
        for await (const item of this.table.toCollection()) {
          yield item.id;
        }
        return;
      } catch (error) {
        console.error('DexieSun keys error, falling back to memory:', error);
        this.isIndexedDBAvailable = false;
      }
    }

    // Fallback to memory storage
    for (const key of this.fallbackData.keys()) {
      yield key;
    }
  }

  async *values(): AsyncGenerator<T, void, unknown> {
    yield* this.find();
  }

  async *entries(): AsyncGenerator<[string, T], void, unknown> {
    if (this.isIndexedDBAvailable && this.table) {
      try {
        for await (const item of this.table.toCollection()) {
          const { id, ...data } = item;
          yield [id, this.deserialize(data) as T];
        }
        return;
      } catch (error) {
        console.error('DexieSun entries error, falling back to memory:', error);
        this.isIndexedDBAvailable = false;
      }
    }

    // Fallback to memory storage
    for (const [key, value] of this.fallbackData.entries()) {
      yield [key, value];
    }
  }

  /**
   * Get information about the storage backend being used
   */
  getStorageInfo(): {
    backend: 'indexeddb' | 'memory';
    dbName?: string;
    tableName?: string;
  } {
    return {
      backend: this.isIndexedDBAvailable ? 'indexeddb' : 'memory',
      dbName: this.isIndexedDBAvailable ? this.dbName : undefined,
      tableName: this.isIndexedDBAvailable ? this.tableName : undefined,
    };
  }
}
