import memorySunF from '../suns/SunMemory';
import type { CollIF, CollSyncIF } from '../types.coll';
import type {
  SchemaLocalIF,
  SendProps,
  SunIFSync,
  TransportResult,
  UniverseIF,
  UniverseName,
} from '../types.multiverse';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: SchemaLocalIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIFSync<RecordType, KeyType>; // will default to memorySunF
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
    this.sun = (sunF ?? memorySunF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  sun: SunIFSync<RecordType, KeyType>;

  get(identity: KeyType): RecordType | undefined {
    return this.sun.get(identity);
  }

  has(key: KeyType): boolean {
    return this.sun.has(key);
  }

  set(key: KeyType, value: RecordType): void {
    this.sun.set(key, value);
  }

  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
  ): RecordType | undefined {
    if (typeof this.sun.mutate !== 'function') {
      throw new Error(
        `collection ${this.name} engine does not support mutation`,
      );
    }
    return this.sun.mutate(key, mutator);
  }

  /**
   * Get all records as a generator of batches
   * @returns Generator that yields batches of records
   */
  getAll(): Generator<Map<KeyType, RecordType>, void, any> {
    if (!this.sun.getAll) {
      throw new Error('getAll method not implemented by engine');
    }
    return this.sun.getAll();
  }
  delete(key: KeyType) {
    if (this.sun.delete) {
      return this.sun.delete(key);
    }
    throw new Error('delete method not implemented by engine');
  }
  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns Generator that yields batches of matching records
   * @throws Error if the engine does not implement find
   */
  find(...args: any[]): Generator<Map<KeyType, RecordType>, void, any> {
    // Process arguments
    let query: any;

    if (args.length === 2 && typeof args[0] === 'string') {
      // Format: find(prop, value)
      const [prop, value] = args;
      query = { [prop]: value };
    } else {
      // Format: find(query) or find(predicate)
      query = args[0];
    }

    // If the engine has a find method, use it
    if (typeof this.sun.find === 'function') {
      return this.sun.find(query);
    }

    // Throw an error if find is not implemented
    throw new Error(`Find method not implemented for collection ${this.name}`);
  }

  /**
   * Map over each record in the collection return the updated items
   * @param mapper - Function to transform each record
   * @returns a Map of record
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType,
  ): Map<KeyType, RecordType> {
    if (typeof this.sun.map === 'function') {
      return this.sun.map((record, key) => mapper(record, key, this));
    }

    if (typeof this.sun.keys !== 'function') {
      throw new Error(
        'This collection cannot implement map: engine as no keys or map  functions',
      );
    }

    return new Map(
      Array.from(this.sun.keys()).map((key) => {
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
    if (typeof this.sun.each === 'function') {
      this.sun.each((record, key) => callback(record, key, this));
      return;
    }

    // Fallback implementation using keys
    if (typeof this.sun.keys !== 'function') {
      throw new Error(
        `Each method not implemented for collection ${this.name}`,
      );
    }
    const keys = this.sun.keys();
    for (const key of keys) {
      const record = this.get(key)!;
      callback(record, key, this);
    }
    return;
  }

  count(): number {
    // If the engine has a count method, use it
    if (typeof this.sun.count === 'function') {
      return this.sun.count();
    }

    // Throw an error if neither count nor keys is implemented
    throw new Error(`Count method not implemented for collection ${this.name}`);
  }

  /**
   * Get multiple records as a generator of {key, value} pairs
   * @param keys Array of record keys to get
   * @returns Generator that yields records one by one
   */
  getMany(keys: KeyType[]): Generator<Map<KeyType, RecordType>> {
    // If the engine has a getMany method, use it
    if (typeof this.sun.getMany !== 'function') {
      console.log(
        'cannot getMany from engine',
        this.sun,
        typeof this.sun.getMany,
      );
      throw new Error(`sun ${this.name} does not have getMany implementation`);
    }

    return this.sun.getMany(keys);
  }

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany(recordMap: Map<KeyType, RecordType>): void {
    // If the engine has a setMany method, use it
    if (typeof this.sun.setMany === 'function') {
      return this.sun.setMany(recordMap);
    }

    recordMap.forEach((record, key) => {
      this.set(key, record);
    });
  }

  sendMany(
    keys: KeyType[],
    props: SendProps<RecordType, KeyType>,
  ): TransportResult {
    // Get the multiverse instance
    const multiverse = this.#universe.multiverse;
    if (!multiverse) {
      throw new Error('sendManny: Multiverse not found');
    }

    const generator = this.getMany(keys);
    return multiverse.transportGenerator({ ...props, generator });
  }

  sendAll(props: SendProps<RecordType, KeyType>): TransportResult {
    // Get the multiverse instance
    const multiverse = this.#universe.multiverse;
    if (!multiverse) {
      throw new Error('Multiverse not found');
    }

    // Get all keys from the collection
    const generator = this.getAll();
    return multiverse.transportGenerator({ ...props, generator });
  }
}
