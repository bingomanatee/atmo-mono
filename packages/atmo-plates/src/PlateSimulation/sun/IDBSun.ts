import type {
  Pair,
  SchemaLocalIF,
  SunIfAsync,
} from '@wonderlandlabs/multiverse';
import { FIELD_TYPES } from '@wonderlandlabs/multiverse';
import type { MutationAction } from '@wonderlandlabs/multiverse/dist';
import type { IDBDatabase } from 'idb';
import { type IDBPDatabase, openDB } from 'idb';
import { Vector3 } from 'three';

interface IDBSunOptions {
  db: IDBDatabase;
  tableName: string;
  schema: SchemaLocalIF<any>;
}

export class IDBSun<
  RecordType extends Record<string, any>,
  K extends string | number,
> implements SunIfAsync<RecordType>
{
  private db: IDBPDatabase | null = null;
  private tableName: string;
  private schema: SchemaLocalIF<RecordType>;
  private isMaster: boolean = false;
  readonly isAsync = true;
  public sunType = 'IDBSun';

  constructor(options: IDBSunOptions) {
    this.tableName = options.tableName;
    this.db = options.db;
    this.schema = options.schema;
  }

  async init(): Promise<void> {
  }

  private serializeField(data: any, fieldName: string): any {
    if (data === null || data === undefined) {
      return data;
    }

    const field = this.schema?.fields?.[fieldName];
    if (!field) {
      return this.serialize(data);
    }

    switch (field.type) {
      case FIELD_TYPES.object:
        if (data instanceof Vector3) {
          return {
            x: data.x,
            y: data.y,
            z: data.z,
          };
        }
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          return data;
        }
        break;

      case FIELD_TYPES.array:
        if (Array.isArray(data)) {
          return data;
        }
        return [];
    }
    return data;
  }


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

  private deserializeField(data: any, fieldName: string): any {
    if (data === null || data === undefined) {
      return data;
    }

    const field = this.schema?.fields?.[fieldName];
    if (!field) {
      return data;
    }

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
      }
    }

    switch (field.type) {
      case FIELD_TYPES.object:
        if (
          field.meta?.isVector3 &&
          typeof data === 'object' &&
          'x' in data &&
          'y' in data &&
          'z' in data
        ) {
          return new Vector3(data.x, data.y, data.z);
        }
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
        return this.deserialize(data);
      case FIELD_TYPES.array:
        if (Array.isArray(data)) {
          return Array.from(data);
        }
        break;
    }
    return this.deserialize(data);
  }

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
    if (!result) {
      return undefined;
    }

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
      }
    }

    return deserialized;
  }

  async set(key: string, value: RecordType): Promise<void> {
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const serializedValue = this.serialize(value);
    const record = { ...serializedValue, id: key };
    await this.db.put(this.tableName, record);
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
        yield [record.id, this.deserialize(record) as RecordType];
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
        yield [result.id, this.deserialize(result)];
      }
    } else if (typeof a === 'function') {
      const allRecords = this.values();
      for await (const pair of allRecords) {
        const [id, record] = pair;
        try {
          if (a(record, id)) {
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
    if (!this.db) {
      throw new Error(`IDBSun not ready for table ${this.tableName}`);
    }

    const store = this.db
      .transaction(this.tableName)
      .objectStore(this.tableName);
    for await (const cursor of store.iterate()) {
      yield [
        cursor.key as string,
        this.deserialize(cursor.value) as RecordType,
      ];
    }
  }

  getStorageInfo() {
    return {
      backend: 'idb',
      dbName: this.dbName,
      tableName: this.tableName,
      role: this.isMaster ? 'master' : 'worker',
    };
  }

  async mutate(key: K, fn: MutationAction) {
    const record = await this.get(key as string);
    if (!record) {
      return;
    }
    const update = fn(record);
    if (update) {
      await this.set(key as string, update);
    }

    return update;
  }
}
