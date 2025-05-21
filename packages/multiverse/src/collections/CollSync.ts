import memorySunF from '../suns/SunMemory';
import { CollBase } from './CollBase';
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
  extends CollBase<RecordType, KeyType>
  implements CollSyncIF<RecordType, KeyType>
{
  isAsync: false = false;
  _sun: SunIFSync<RecordType, KeyType>;

  // Define the sun property required by CollBase
  protected get sun(): SunIF<RecordType, KeyType> {
    return this._sun;
  }

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    super(name, schema, universe);
    this._sun = (sunF ?? memorySunF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  get(identity: KeyType): RecordType | undefined {
    return this._sun.get(identity);
  }

  has(key: KeyType): boolean {
    return this._sun.has(key);
  }

  set(key: KeyType, value: RecordType): void {
    // Validate the record before setting it
    this.validate(value);
    this._sun.set(key, value);
  }

  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
  ): RecordType | undefined {
    if (typeof this._sun.mutate !== 'function') {
      throw new Error(`collection ${this.name} sun does not support mutation`);
    }
    return this._sun.mutate(key, mutator);
  }

  /**
   * Get all records as a generator of batches
   * @returns Generator that yields batches of records
   */
  getAll(): Generator<Map<KeyType, RecordType>, void, any> {
    if (!this._sun.getAll) {
      throw new Error('getAll method not implemented by sun');
    }
    return this._sun.getAll();
  }
  delete(key: KeyType) {
    if (this._sun.delete) {
      return this._sun.delete(key);
    }
    throw new Error('delete method not implemented by sun');
  }
  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns Generator that yields batches of matching records
   * @throws Error if the sun does not implement find
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

    // If the sun has a find method, use it
    if (typeof this._sun.find === 'function') {
      return this._sun.find(query);
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
    if (typeof this._sun.map === 'function') {
      return this._sun.map((record, key) => mapper(record, key, this));
    }

    if (typeof this._sun.keys !== 'function') {
      throw new Error(
        'This collection cannot implement map: sun has no keys or map functions',
      );
    }

    return new Map(
      Array.from(this._sun.keys()).map((key) => {
        const record = this.get(key)!;
        return [key, mapper(record, key, this)];
      }),
    );
  }

  send(key: KeyType, target: UniverseName): void {
    if (!this.universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.universe.name,
      );
    }
    if (!this.has(key)) throw new Error(this.name + 'does not have key ' + key);
    this.universe.multiverse.transport(key, {
      collectionName: this.name,
      fromU: this.universe.name,
      toU: target,
    });
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
    // If the sun has an each method, use it
    if (typeof this._sun.each === 'function') {
      this._sun.each((record, key) => callback(record, key, this));
      return;
    }

    // Fallback implementation using keys
    if (typeof this._sun.keys !== 'function') {
      throw new Error(
        `Each method not implemented for collection ${this.name}`,
      );
    }
    const keys = this._sun.keys();
    for (const key of keys) {
      const record = this.get(key)!;
      callback(record, key, this);
    }
    return;
  }

  count(): number {
    // If the sun has a count method, use it
    if (typeof this._sun.count === 'function') {
      return this._sun.count();
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
    // If the sun has a getMany method, use it
    if (typeof this._sun.getMany !== 'function') {
      console.log(
        'cannot getMany from sun',
        this._sun,
        typeof this._sun.getMany,
      );
      throw new Error(`sun ${this.name} does not have getMany implementation`);
    }

    return this._sun.getMany(keys);
  }

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany(recordMap: Map<KeyType, RecordType>): void {
    // If the sun has a setMany method, use it
    if (typeof this._sun.setMany === 'function') {
      return this._sun.setMany(recordMap);
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
    const multiverse = this.universe.multiverse;
    if (!multiverse) {
      throw new Error('sendManny: Multiverse not found');
    }

    const generator = this.getMany(keys);
    return multiverse.transportGenerator({ ...props, generator });
  }

  sendAll(props: SendProps<RecordType, KeyType>): TransportResult {
    // Get the multiverse instance
    const multiverse = this.universe.multiverse;
    if (!multiverse) {
      throw new Error('Multiverse not found');
    }

    // Get all keys from the collection
    const generator = this.getAll();
    return multiverse.transportGenerator({ ...props, generator });
  }
}
