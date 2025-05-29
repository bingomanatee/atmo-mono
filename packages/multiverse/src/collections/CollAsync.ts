import { memoryAsyncSunF } from '../suns/SunMemoryAsync';
import type { CollIF } from '../types.coll';
import type {
  CollAsyncIF,
  SchemaLocalIF,
  SunIfAsync,
  UniverseIF,
  UniverseName,
  MutationAction,
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
    return this.sun.find(query, value);
  }

  async mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
    ) => Promise<RecordType | undefined | MutationAction>,
  ): Promise<RecordType | undefined> {
    return this.sun.mutate(key, mutator);
  }

  getMany(keys: KeyType[]) {
    if (!this.sun.getMany) {
      throw new Error('getAll method not implemented by sun');
    }
    return this.sun.getMany(keys);
  }

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   * @returns A promise that resolves when all callbacks have been called
   */
  async each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => void | Promise<void>,
  ): Promise<void> {
    // If the sun has an each method, use it
    if (typeof this.sun.each === 'function') {
      await this.sun.each((record, key) => callback(record, key, this));
      return;
    }

    // Fallback implementation using keys
    if (typeof this.sun.keys === 'function') {
      const keys = await this.sun.keys();

      // Process all keys in parallel
      await Promise.all(
        keys.map(async (key) => {
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
  async map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => Promise<RecordType>,
  ): Promise<Map<KeyType, RecordType>> {
    // If the sun has a map method, use it
    if (typeof this.sun.map === 'function') {
      return this.sun.map(mapper);
    }
    if (!(typeof this.sun.keys === 'function')) {
      throw new Error(
        `each not implemented in ${this.name}; sun has no keys or map function`,
      );
    }

    const keys = await this.sun.keys();
    const values: RecordType[] = Promise.all(
      Array.from(keys).map(async () => {
        const record = await this.get(record);
        if (record !== undefined) {
          return mapper(record, key, this);
        }
      }),
    );

    return new Map(keys.map((key, index) => [values[index], key]));
  }

  async send(key: KeyType, target: UniverseName) {
    if (!this.universe) {
      throw new Error('Universe not set in CollAsync');
    }

    if (!this.universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.universe.name,
      );
    }

    const multiverse = this.universe.multiverse;
    return multiverse.transport(key, this.name, this.universe.name, target);
  }
}
