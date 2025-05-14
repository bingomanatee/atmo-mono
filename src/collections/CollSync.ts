import { Observable } from 'rxjs';
import memorySunF from '../suns/SunMemory.ts';
import type { CollIF, CollSyncIF } from '../types.coll.ts';
import type {
  SchemaLocalIF,
  SunIFSync,
  UniverseIF,
  UniverseName,
} from '../types.multiverse.ts';

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
    this.#engine = (sunF ?? memorySunF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  #engine: SunIFSync<RecordType, KeyType>;

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
    if (typeof this.#engine.mutate !== 'function') {
      throw new Error(
        `collection ${this.name} engine does not support mutation`,
      );
    }
    return this.#engine.mutate(key, mutator);
  }

  /**
   * Get all records as a generator of batches
   * @returns Generator that yields batches of records
   */
  getAll(): Generator<Map<KeyType, RecordType>, void, any> {
    if (!this.#engine.getAll) {
      throw new Error('getAll method not implemented by engine');
    }
    return this.#engine.getAll();
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
    if (typeof this.#engine.find === 'function') {
      return this.#engine.find(query);
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

  /**
   * Get multiple records as a generator of batches
   * @param keys Array of record keys to get
   * @returns Generator that yields batches of records
   */
  getMany(keys: KeyType[]): Generator<Map<KeyType, RecordType>, void, any> {
    if (!this.#engine.getMany) {
      throw new Error('getMany method not implemented by engine');
    }
    return this.#engine.getMany(keys);
  }

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany(recordMap: Map<KeyType, RecordType>): number {
    // If the engine has a setMany method, use it
    if (typeof this.#engine.setMany === 'function') {
      return this.#engine.setMany(recordMap);
    }

    // Fallback implementation using set
    let count = 0;
    for (const [key, record] of recordMap.entries()) {
      try {
        this.set(key, record);
        count++;
      } catch (error) {
        console.error(`Error setting record ${key}:`, error);
      }
    }

    return count;
  }

  /**
   * Send multiple records to another universe
   * @param keys Array of record keys to send
   * @param target Target universe name
   * @returns Observable that emits progress updates
   */
  sendMany(
    keys: KeyType[],
    target: UniverseName,
  ): Observable<{
    processed: number;
    successful: number;
    failed: number;
    total: number;
    key?: KeyType;
    error?: Error;
  }> {
    // Get the multiverse instance
    const multiverse = this.#universe.multiverse;
    if (!multiverse) {
      throw new Error('Multiverse not found');
    }

    // Use the generator-based approach for better performance and memory usage
    const recordGenerator = this.getMany(keys);

    // Use transportGenerator to send the records to the target universe
    return multiverse.transportGenerator(
      recordGenerator,
      this.name,
      this.#universe.name,
      target,
    );
  }

  /**
   * Send all records to another universe
   * @param target Target universe name
   * @returns Observable that emits progress updates
   */
  sendAll(
    target: UniverseName,
  ): Observable<{
    processed: number;
    successful: number;
    failed: number;
    total: number;
    key?: KeyType;
    error?: Error;
  }> {
    // Get the multiverse instance
    const multiverse = this.#universe.multiverse;
    if (!multiverse) {
      throw new Error('Multiverse not found');
    }

    // Use the generator-based approach for better performance and memory usage
    const recordGenerator = this.getAll();

    // Use transportGenerator to send the records to the target universe
    return multiverse.transportGenerator(
      recordGenerator,
      this.name,
      this.#universe.name,
      target,
    );
  }
}
