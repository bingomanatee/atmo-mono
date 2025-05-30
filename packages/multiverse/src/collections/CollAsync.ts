import { memoryAsyncSunF } from '../suns/SunMemoryAsync';
import { Observable } from 'rxjs';
import type { CollIF } from '../types.coll';
import type {
  CollAsyncIF,
  SchemaLocalIF,
  SunIfAsync,
  UniverseIF,
  UniverseName,
  MutationAction,
  MutatorAsync,
  DataRecord,
  DataKey,
} from '../types.multiverse';
import { CollBase } from './CollBase';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: SchemaLocalIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIfAsync<RecordType, KeyType>; // will default to memorySunF
};

export class CollAsync<
    RecordType extends DataRecord = DataRecord,
    KeyType extends DataKey = DataKey,
  >
  extends CollBase<RecordType, KeyType>
  implements CollAsyncIF<RecordType, KeyType>
{
  isAsync: true = true;
  protected _sunF: (
    coll: CollIF<RecordType, KeyType>,
  ) => SunIfAsync<RecordType, KeyType>;

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    super(name, schema, universe);
    this._sunF = sunF ?? memoryAsyncSunF;
    if (universe) {
      universe.add(this);
      this.universe = universe;
    }
  }

  async get(key: KeyType): Promise<RecordType | undefined> {
    return this.sun.get(key);
  }

  async set(key: KeyType, value: RecordType): Promise<void> {
    await this.sun.set(key, value);
  }

  async has(key: KeyType): Promise<boolean> {
    return this.sun.has(key);
  }

  async delete(key: KeyType): Promise<void> {
    await this.sun.delete(key);
  }

  async clear(): Promise<void> {
    await this.sun.clear();
  }

  values(): AsyncGenerator<[KeyType, RecordType]> {
    return this.sun.values();
  }

  find(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): AsyncGenerator<[KeyType, RecordType]> {
    if (typeof this.sun.find !== 'function') {
      throw new Error('Find method not implemented');
    }
    // Pass arguments correctly to sun's find method which expects spread args
    if (value !== undefined) {
      return this.sun.find(query, value);
    } else {
      return this.sun.find(query);
    }
  }

  async mutate(
    key: KeyType,
    mutator: MutatorAsync<RecordType, KeyType>,
  ): Promise<RecordType | undefined> {
    return this.sun.mutate(key, mutator);
  }

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   * @param batchSize - Optional batch size for parallel processing
   * @returns A promise that resolves when all callbacks have been called
   */
  async each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => void | Promise<void>,
    batchSize?: number,
  ): Promise<void> {
    // If the sun has an each method, use it
    if (typeof this.sun.each === 'function') {
      await this.sun.each(
        (record: RecordType, key: KeyType) => callback(record, key, this),
        batchSize,
      );
      return;
    }

    // Fallback implementation using keys
    if (typeof this.sun.keys === 'function') {
      const keys = await this.sun.keys();

      // Process all keys in parallel
      await Promise.all(
        keys.map(async (key: KeyType) => {
          const record = await this.get(key);
          if (record !== undefined) {
            await Promise.resolve(callback(record, key, this));
          }
        }),
      );

      return;
    }

    // Throw an error if neither each nor keys is implemented
    throw new Error(`Each method not implemented for collection ${this.name}`);
  }

  /**
   * Get the number of records in the collection
   * @returns A promise that resolves to the number of records
   */
  async count(): Promise<number> {
    // If the sun has a count method, use it
    if (typeof this.sun.count === 'function') {
      return this.sun.count();
    }

    // Fallback implementation using keys
    if (typeof this.sun.keys === 'function') {
      const keys = await this.sun.keys();
      return keys.length;
    }

    // Throw an error if neither count nor keys is implemented
    throw new Error(
      `Count method not implemented for collection ${this.name} no each or keys method in sun`,
    );
  }

  /**
   * Map over each record in the collection and apply a transformation
   * @param mapper - Function to transform each record
   * @param noTransaction - If true, changes are applied immediately without transaction support
   * @returns A promise that resolves to the number of records processed
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  async *map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => RecordType,
  ): AsyncGenerator<[KeyType, RecordType]> {
    // If the sun has a map method, use it
    if (typeof this.sun.map === 'function') {
      // The async sun's map method returns AsyncGenerator
      yield* this.sun.map((record: RecordType, key: KeyType) =>
        mapper(record, key, this),
      );
      return;
    }
    if (!(typeof this.sun.keys === 'function')) {
      throw new Error(
        `map not implemented in ${this.name}; sun has no keys or map function`,
      );
    }

    const keys = await this.sun.keys();

    for (const key of keys) {
      const record = await this.get(key);
      if (record !== undefined) {
        const mappedRecord = mapper(record, key, this); // Sync call
        yield [key, mappedRecord];
      }
    }
  }

  async send(key: KeyType, target: UniverseName): Promise<any> {
    // TransportResult
    if (!this.universe) {
      throw new Error('Universe not set in CollAsync');
    }

    if (!this.universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.universe.name,
      );
    }

    const multiverse = this.universe.multiverse;
    return multiverse.transport(key, {
      collectionName: this.name,
      fromU: this.universe.name,
      toU: target,
    });
  }

  async getMany(keys: KeyType[]): Promise<Map<KeyType, RecordType>> {
    const map = new Map<KeyType, RecordType>();
    for (const key of keys) {
      const value = await this.get(key);
      if (value !== undefined) {
        map.set(key, value);
      }
    }
    return map;
  }

  async setMany(recordMap: Map<KeyType, RecordType>): Promise<void> {
    // If the sun has a setMany method, use it
    if (typeof this.sun.setMany === 'function') {
      return this.sun.setMany(recordMap);
    }

    // Fallback implementation using individual sets
    for (const [key, record] of recordMap) {
      await this.set(key, record);
    }
  }

  async deleteMany(keys: KeyType[]): Promise<void> {
    // If the sun has a deleteMany method, use it
    if (typeof this.sun.deleteMany === 'function') {
      return this.sun.deleteMany(keys);
    }

    // Fallback implementation using individual deletes
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async sendMany(
    keys: KeyType[],
    props: any, // SendProps<RecordType, KeyType>
  ): Promise<any> {
    // TransportResult
    // Get the multiverse instance
    const multiverse = this.universe.multiverse;
    if (!multiverse) {
      throw new Error('sendMany: Multiverse not found');
    }

    // Create an async generator that yields [key, value] pairs
    const generator = async function* (this: CollAsync<RecordType, KeyType>) {
      for (const key of keys) {
        const value = await this.get(key);
        if (value !== undefined) {
          yield [key, value] as [KeyType, RecordType];
        }
      }
    }.bind(this)();

    return multiverse.transportGenerator({ ...props, generator });
  }

  async sendAll(props: any): Promise<any> {
    // TransportResult
    // Get the multiverse instance
    const multiverse = this.universe.multiverse;
    if (!multiverse) {
      throw new Error('sendAll: Multiverse not found');
    }

    // Get all records as a generator
    const generator = this.values();
    return multiverse.transportGenerator({ ...props, generator });
  }

  [Symbol.iterator](): Iterator<[KeyType, RecordType]> {
    // For async collections, we need to return a sync iterator
    // This is a simplified implementation that converts async to sync
    const asyncGen = this.values();
    const results: [KeyType, RecordType][] = [];

    // Note: This is a simplified sync iterator for async data
    // In practice, you'd want to use for-await-of with the async generator
    return results[Symbol.iterator]();
  }

  // Streaming methods for reactive programming
  getMany$(keys: KeyType[]): Observable<{ key: KeyType; value: RecordType }> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          for (const key of keys) {
            const value = await this.get(key);
            if (value !== undefined) {
              subscriber.next({ key, value });
            }
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  getAll$(): Observable<{ key: KeyType; value: RecordType }> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const [key, value] of this.values()) {
            subscriber.next({ key, value });
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  sendMany$(
    keys: KeyType[],
    target: UniverseName,
  ): Observable<{ key: KeyType; value: RecordType; sent: boolean }> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          for (const key of keys) {
            const value = await this.get(key);
            if (value !== undefined) {
              try {
                await this.send(key, target);
                subscriber.next({ key, value, sent: true });
              } catch (error) {
                subscriber.next({ key, value, sent: false });
              }
            }
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
