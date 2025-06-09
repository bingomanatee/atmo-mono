import { AsyncSunIF, SchemaLocalIF } from '@wonderlandlabs/multiverse';
import Dexie from 'dexie';
import { Vector3 } from 'three';
import { log } from '../utils/utils';

interface PassiveDexieSunOptions {
  dbName: string;
  tableName: string;
  schema: SchemaLocalIF<any>; // Still need schema for serialization/deserialization
}

interface SerializableVector3 {
  x: number;
  y: number;
  z: number;
  _isVector3: true;
}

/**
 * Passive DexieSun that connects to an existing database without initializing it
 * Assumes the database and table already exist (created by another instance)
 */
export class PassiveDexieSun<T extends Record<string, any>>
  implements AsyncSunIF<T>
{
  private db: Dexie | null = null;
  private table: Dexie.Table<T & { id: string }, string> | null = null;
  private tableName: string;
  private dbName: string;
  private schema: SchemaLocalIF<T>;

  readonly isAsync = true;

  constructor(options: PassiveDexieSunOptions) {
    this.tableName = options.tableName;
    this.dbName = options.dbName;
    this.schema = options.schema;

    this.connectToExistingDatabase();
  }

  /**
   * Connect to existing database without schema definition
   * Assumes database was already created by master instance
   */
  private async connectToExistingDatabase(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      log(`🔌 PassiveDexieSun: Connecting to existing database ${this.dbName}`);

      // Create Dexie instance WITHOUT calling .version().stores()
      this.db = new Dexie(this.dbName);

      // Try to open the existing database
      await this.db.open();

      // Get table reference (assumes table already exists)
      this.table = this.db.table(this.tableName);

      // Test table access to verify it exists
      await this.table.count();

      log(
        `✅ PassiveDexieSun: Connected to existing table ${this.dbName}.${this.tableName}`,
      );
    } catch (error) {
      log(`❌ PassiveDexieSun: Failed to connect to existing database:`, error);
      throw new Error(
        `Cannot connect to existing database ${this.dbName}.${this.tableName}: ${error.message}`,
      );
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
   * Deserialize data from storage using schema definitions
   */
  private deserialize(data: any, fieldName?: string): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Handle Vector3 objects (legacy support)
    if (data && typeof data === 'object' && data._isVector3) {
      return new Vector3(data.x, data.y, data.z);
    }

    // If we have a field name and schema, use schema-based deserialization
    if (fieldName && this.schema?.fields?.[fieldName]) {
      const field = this.schema.fields[fieldName];

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

      // Handle different field types
      switch (field.type) {
        case 'Object':
          if (
            typeof data === 'object' &&
            data !== null &&
            !Array.isArray(data)
          ) {
            // If field has univFields mapping, reconstruct nested object
            if (field.univFields && typeof field.univFields === 'object') {
              const reconstructed: any = {};
              for (const [localKey, universalKey] of Object.entries(
                field.univFields,
              )) {
                if (data.hasOwnProperty(universalKey)) {
                  reconstructed[localKey] = this.deserialize(
                    data[universalKey],
                  );
                }
              }
              return reconstructed;
            }
            // Otherwise deserialize all properties
            const deserialized: any = {};
            for (const [key, value] of Object.entries(data)) {
              deserialized[key] = this.deserialize(value);
            }
            return deserialized;
          }
          break;

        case 'Array':
          if (Array.isArray(data)) {
            return data.map((item) => this.deserialize(item));
          }
          break;
      }
    }

    // Default handling for objects and arrays without schema info
    if (typeof data === 'object' && data !== null) {
      const deserialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        deserialized[key] = this.deserialize(value, key);
      }
      return deserialized;
    }

    return data;
  }

  async get(key: string): Promise<T | undefined> {
    if (!this.table) {
      throw new Error(
        `PassiveDexieSun not connected to table ${this.tableName}`,
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
        `PassiveDexieSun not connected to table ${this.tableName}`,
      );
    }

    const serializedValue = this.serialize(value);
    const record = { ...serializedValue, id: key };
    await this.table.put(record);
  }

  async delete(key: string): Promise<void> {
    if (!this.table) {
      throw new Error(
        `PassiveDexieSun not connected to table ${this.tableName}`,
      );
    }

    await this.table.delete(key);
  }

  async clear(): Promise<void> {
    if (!this.table) {
      throw new Error(
        `PassiveDexieSun not connected to table ${this.tableName}`,
      );
    }

    await this.table.clear();
  }

  async has(key: string): Promise<boolean> {
    if (!this.table) {
      throw new Error(
        `PassiveDexieSun not connected to table ${this.tableName}`,
      );
    }

    const result = await this.table.get(key);
    return result !== undefined;
  }

  async count(): Promise<number> {
    if (!this.table) {
      throw new Error(
        `PassiveDexieSun not connected to table ${this.tableName}`,
      );
    }

    return await this.table.count();
  }

  async *find(query?: any): AsyncGenerator<T, void, unknown> {
    if (!this.table) {
      throw new Error(
        `PassiveDexieSun not connected to table ${this.tableName}`,
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
        `PassiveDexieSun not connected to table ${this.tableName}`,
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
        `PassiveDexieSun not connected to table ${this.tableName}`,
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
    backend: 'passive-indexeddb';
    dbName: string;
    tableName: string;
  } {
    return {
      backend: 'passive-indexeddb',
      dbName: this.dbName,
      tableName: this.tableName,
    };
  }
}
