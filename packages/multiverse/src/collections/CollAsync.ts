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
  protected _universe: UniverseIF;
  schema: SchemaLocalIF;
  isAsync: true = true;

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    this.name = name;
    this.schema = schema;
    this._universe = universe;
    this._sun = (sunF ?? sunMemoryAsyncF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  protected _sun: SunIfAsync<RecordType, KeyType>;

  async get(identity: KeyType) {
    return this._sun.get(identity);
  }

  async has(key: KeyType) {
    return this._sun.has(key);
  }

  async set(key: KeyType, value: RecordType) {
    this._sun.set(key, value);
  }

  async mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => RecordType | void | any | Promise<RecordType | void | any>,
  ): Promise<RecordType | undefined> {
    if (this._sun.mutate) {
      return this._sun.mutate(key, (draft) => mutator(draft, this));
    } else {
      // Fallback for suns that don't support mutate
      const existing = await this.get(key);
      if (!existing) return undefined;
      const result = await mutator(existing, this);
      await this.set(key, result);
      return this.get(key);
    }
  }

  getMany(keys: KeyType[]) {
    if (!this._sun.getMany) {
      throw new Error('getAll method not implemented by sun');
    }
    return this._sun.getMany(keys);
  }

  delete(key: KeyType): Promise<void> {
    if (this._sun.delete) {
      return this._sun.delete(key);
    }
    throw new Error(
      `delete method not implemented for collection ${this.name}`,
    );
  }

  values() {
    return this._sun.values();
  }

  find(...query: any[]): Generator<[KeyType, RecordType]> {
    if (typeof this._sun.find === 'function') {
      return this._sun.find(...query);
    }

    // Throw an error if find is not implemented
    throw new Error(
      `Find method not implemented for sun in collection ${this.name}`,
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
    // If the sun has an each method, use it
    if (typeof this._sun.each === 'function') {
      await this._sun.each((record, key) => callback(record, key, this));
      return;
    }

    // Fallback implementation using keys
    if (typeof this._sun.keys === 'function') {
      const keys = await this._sun.keys();

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
    if (typeof this._sun.count === 'function') {
      return this._sun.count();
    }

    // Fallback implementation using keys
    if (typeof this._sun.keys === 'function') {
      const keys = await this._sun.keys();
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
    if (typeof this._sun.map === 'function') {
      return this._sun.map(mapper);
    }
    if (!(typeof this._sun.keys === 'function')) {
      throw new Error(
        `each not implemented in ${this.name}; sun has no keys or map function`,
      );
    }

    const keys = await this._sun.keys();
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
    if (!this._universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this._universe.name,
      );
    }

    const multiverse = this._universe.multiverse;
    return multiverse.transport(key, this.name, this._universe.name, target);
  }
}
