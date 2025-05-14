import sunMemoryAsyncF from '../suns/SunMemoryAsync';
import type { CollIF } from '../types.coll';
import type {
  CollAsyncIF,
  SchemaLocalIF,
  SunIfAsync,
  UniverseIF,
} from '../types.multiverse';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: SchemaLocalIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIfAsync<RecordType, KeyType>; // will default to memorySunF
};

export class CollAsync<RecordType, KeyType = string>
  implements CollAsyncIF<RecordType, KeyType>
{
  name: string;
  #universe: UniverseIF;
  schema: SchemaLocalIF;
  isAsync: true = true;

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    this.name = name;
    this.schema = schema;
    this.#universe = universe;
    this.#engine = (sunF ?? sunMemoryAsyncF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  #engine: SunIfAsync<RecordType, KeyType>;

  async get(identity: KeyType) {
    return this.#engine.get(identity);
  }

  async has(key: KeyType) {
    return this.#engine.has(key);
  }

  async set(key: KeyType, value: RecordType) {
    this.#engine.set(key, value);
  }

  async mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => RecordType | void | any | Promise<RecordType | void | any>,
  ): Promise<RecordType | undefined> {
    if (this.#engine.mutate) {
      return this.#engine.mutate(key, (draft) => mutator(draft, this));
    } else {
      // Fallback for engines that don't support mutate
      const existing = await this.get(key);
      if (!existing) return undefined;
      const result = await mutator(existing, this);
      await this.set(key, result);
      return this.get(key);
    }
  }

  getMany(keys: KeyType[]) {
    if (!this.#engine.getMany) {
      throw new Error('getAll method not implemented by engine');
    }
    return this.#engine.getMany(keys);
  }

  getAll(): AsyncGenerator<Map<KeyType, RecordType>, void, any> {
    if (!this.#engine.getAll) {
      throw new Error('getAll method not implemented by engine');
    }
    return this.#engine.getAll();
  }

  find(...query: any[]): Generator<Map<KeyType, RecordType>> {
    if (typeof this.#engine.find === 'function') {
      return this.#engine.find(...query);
    }

    // Throw an error if find is not implemented
    throw new Error(
      `Find method not implemented for engine in collection ${this.name}`,
    );
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
    // If the engine has an each method, use it
    if (typeof this.#engine.each === 'function') {
      await this.#engine.each((record, key) => callback(record, key, this));
      return;
    }

    // Fallback implementation using keys
    if (typeof this.#engine.keys === 'function') {
      const keys = await this.#engine.keys();

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
    // If the engine has a count method, use it
    if (typeof this.#engine.count === 'function') {
      return this.#engine.count();
    }

    // Fallback implementation using keys
    if (typeof this.#engine.keys === 'function') {
      const keys = await this.#engine.keys();
      return keys.length;
    }

    // Throw an error if neither count nor keys is implemented
    throw new Error(
      `Count method not implemented for collection ${this.name} no each or keys method in engine`,
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
    // If the engine has a map method, use it
    if (typeof this.#engine.map === 'function') {
      return this.#engine.map(mapper);
    }
    if (!(typeof this.#engine.keys === 'function')) {
      throw new Error(
        `each not implemented in ${this.name}; engine has no keys or map function`,
      );
    }

    const keys = await this.#engine.keys();
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
    if (!this.#universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.#universe.name,
      );
    }

    const multiverse = this.#universe.multiverse;
    return multiverse.transport(key, this.name, this.#universe.name, target);
  }
}
