import type {
  CollBaseIF,
  SchemaLocalIF,
  SunIF,
  UniverseIF,
  UniverseName,
} from './types.multiverse';
import memorySunF from './suns/SunMemory.ts';
import type { CollIF, CollSyncIF } from './types.coll';
import { asError } from '@wonderlandlabs/atmo-utils/src';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: SchemaLocalIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIF<RecordType, KeyType>; // will default to memorySunF
};

export class CollSync<RecordType, KeyType = string>
  implements CollSyncIF<RecordType, KeyType>
{
  name: string;
  #universe: UniverseIF;
  schema: SchemaLocalIF;
  isAsync: false = false;

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    this.name = name;
    this.schema = schema;
    this.#universe = universe;
    this.#engine = (sunF ?? memorySunF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  #engine: SunIF<RecordType, KeyType>;

  get(identity: KeyType): RecordType | undefined {
    return this.#engine.get(identity);
  }

  has(key: KeyType): boolean {
    return this.#engine.has(key);
  }

  set(key: KeyType, value: RecordType): void {
    this.#engine.set(key, value);
  }

  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
  ): RecordType | undefined {
    if (this.#engine.mutate) {
      return this.#engine.mutate(key, (draft) => mutator(draft, this));
    } else {
      // Fallback for engines that don't support mutate
      const existing = this.get(key);
      const result = mutator(existing, this) || existing;
      if (result) {
        this.set(key, result);
      }
      return result;
    }
  }

  /**
   * Find records matching a query
   * The implementation of this method is engine-dependent
   * @param query - The query to match against
   * @returns An array of records matching the query
   * @throws Error if the engine does not implement find
   */
  find(query: any): RecordType[] {
    // If the engine has a find method, use it
    if (typeof this.#engine.find === 'function') {
      return this.#engine.find(query);
    }

    // Throw an error if find is not implemented
    throw new Error(`Find method not implemented for collection ${this.name}`);
  }

  /**
   * Map over each record in the collection and apply a transformation
   * @param mapper - Function to transform each record
   * @param noTransaction - If true, changes are applied immediately without transaction support
   * @returns The number of records processed
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType,
  ): Map<KeyType, RecordType> {
    if (typeof this.#engine.map === 'function') {
      return this.#engine.map((record, key) => mapper(record, key, this));
    }

    if (typeof this.#engine.keys !== 'function') {
      throw new Error(
        'This collection cannot implement map: engine as no keys or map  functions',
      );
    }

    return new Map(
      Array.from(this.#engine.keys()).map((key) => {
        const record = this.get(key)!;
        return [key, mapper(record, key, this)];
      }),
    );
  }

  send(key: KeyType, target: UniverseName): void {
    if (!this.#universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.#universe.name,
      );
    }
    if (!this.has(key)) throw new Error(this.name + 'does not have key ' + key);
    this.#universe.multiverse.transport(
      key,
      this.name,
      this.#universe.name,
      target,
    );
  }

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   */
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => void,
  ): void {
    // If the engine has an each method, use it
    if (typeof this.#engine.each === 'function') {
      this.#engine.each((record, key) => callback(record, key, this));
      return;
    }

    // Fallback implementation using keys
    if (typeof this.#engine.keys !== 'function') {
      throw new Error(
        `Each method not implemented for collection ${this.name}`,
      );
    }
    const keys = this.#engine.keys();
    for (const key of keys) {
      const record = this.get(key)!;
      callback(record, key, this);
    }
    return;
  }

  /**
   * Get the number of records in the collection
   * @returns The number of records
   */
  count(): number {
    // If the engine has a count method, use it
    if (typeof this.#engine.count === 'function') {
      return this.#engine.count();
    }

    // Fallback implementation using keys
    if (typeof this.#engine.keys === 'function') {
      return this.#engine.keys().length;
    }

    // Throw an error if neither count nor keys is implemented
    throw new Error(`Count method not implemented for collection ${this.name}`);
  }
}
