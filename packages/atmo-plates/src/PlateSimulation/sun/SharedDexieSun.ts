import { AsyncSunIF, SchemaLocalIF } from '@wonderlandlabs/multiverse';
import Dexie from 'dexie';
import { Vector3 } from 'three';
import { SharedDexieManager } from './SharedDexieManager';

interface SharedDexieSunOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>;
  allSchemas: Record<string, SchemaLocalIF<any>>; // All table schemas for shared manager
  dontClear?: boolean;
}

interface SerializableVector3 {
  x: number;
  y: number;
  z: number;
  _isVector3: true;
}

/**
 * IndexedDB-backed AsyncSun using SharedDexieManager
 * Multiple instances can safely access the same database without schema conflicts
 */
export class SharedDexieSun<T extends Record<string, any>> implements AsyncSunIF<T> {
  private manager: SharedDexieManager | null = null;
  private table: Dexie.Table<T & { id: string }, string> | null = null;
  private tableName: string;
  private dbName: string;
  private schema: SchemaLocalIF<T>;
  private allSchemas: Record<string, SchemaLocalIF<any>>;
  private dontClear: boolean = false;

  readonly isAsync = true;

  constructor(options: SharedDexieSunOptions) {
    this.tableName = options.tableName;
    this.dbName = options.dbName;
    this.schema = options.schema;
    this.allSchemas = options.allSchemas;
    this.dontClear = options.dontClear || false;

    this.initializeDatabase();
  }

  /**
   * Initialize database using shared manager
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Get shared manager instance
      this.manager = await SharedDexieManager.getInstance({
        dbName: this.dbName,
        schemas: this.allSchemas,
        dontClear: this.dontClear,
      });

      // Get our specific table
      this.table = this.manager.getTable<T>(this.tableName);

      console.log(`✅ SharedDexieSun initialized for table: ${this.tableName}`);
    } catch (error) {
      console.error(`❌ SharedDexieSun initialization failed for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Ensure database is ready before operations
   */
  private async ensureReady(): Promise<void> {
    if (!this.manager || !this.table) {
      await this.initializeDatabase();
    }
    
    if (!this.manager?.isReady() || !this.table) {
      throw new Error(`SharedDexieSun not ready for table ${this.tableName}`);
    }
  }

  async get(key: string): Promise<T | undefined> {
    await this.ensureReady();
    
    const result = await this.table!.get(key);
    if (!result) return undefined;

    // Remove the id property that was added for Dexie and deserialize
    const { id, ...data } = result;
    return this.deserialize(data) as T;
  }

  async set(key: string, value: T): Promise<void> {
    await this.ensureReady();
    
    // Serialize the value and add id property for Dexie
    const serializedValue = this.serialize(value);
    const record = { ...serializedValue, id: key };
    await this.table!.put(record);
  }

  async delete(key: string): Promise<void> {
    await this.ensureReady();
    await this.table!.delete(key);
  }

  async clear(): Promise<void> {
    await this.ensureReady();
    await this.table!.clear();
  }

  async has(key: string): Promise<boolean> {
    await this.ensureReady();
    const result = await this.table!.get(key);
    return result !== undefined;
  }

  async count(): Promise<number> {
    await this.ensureReady();
    return await this.table!.count();
  }

  async *find(query?: any): AsyncGenerator<T, void, unknown> {
    await this.ensureReady();
    
    let collection;

    if (!query) {
      collection = this.table!.toCollection();
    } else if (typeof query === 'string') {
      const item = await this.table!.get(query);
      if (item) {
        const { id, ...data } = item;
        yield this.deserialize(data) as T;
      }
      return;
    } else {
      // Object query - use filter for client-side matching
      collection = this.table!.toCollection().filter((item: any) => {
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
    await this.ensureReady();
    
    for await (const item of this.table!.toCollection()) {
      yield item.id;
    }
  }

  async *values(): AsyncGenerator<T, void, unknown> {
    yield* this.find();
  }

  async *entries(): AsyncGenerator<[string, T], void, unknown> {
    await this.ensureReady();
    
    for await (const item of this.table!.toCollection()) {
      const { id, ...data } = item;
      yield [id, this.deserialize(data) as T];
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

  /**
   * Get information about the storage backend being used
   */
  getStorageInfo(): {
    backend: 'shared-indexeddb';
    dbName: string;
    tableName: string;
    ready: boolean;
  } {
    return {
      backend: 'shared-indexeddb',
      dbName: this.dbName,
      tableName: this.tableName,
      ready: this.manager?.isReady() || false,
    };
  }
}
