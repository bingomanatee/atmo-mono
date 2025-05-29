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
  MutationAction,
  DataRecord,
  DataKey,
} from '../types.multiverse';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: SchemaLocalIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIFSync<RecordType, KeyType>; // will default to memorySunF
};

export class CollSync<
    RecordType extends DataRecord = DataRecord,
    KeyType extends DataKey = DataKey,
  >
  extends CollBase<RecordType, KeyType>
  implements CollSyncIF<RecordType, KeyType>
{
  isAsync: false = false;
  protected _sunF = memorySunF;
  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    super(name, schema, universe);
    if (sunF) {
      this._sunF = sunF;
    }
    if (universe) {
      universe.add(this);
    }
  }

  get(key: KeyType): RecordType | undefined {
    return this.sun.get(key);
  }

  has(key: KeyType): boolean {
    return this.sun.has(key);
  }

  set(key: KeyType, value: RecordType, skipValidate = false): void {
    if (!skipValidate) {
      this.validate(value);
    }
    this.sun.set(key, value);
  }

  delete(key: KeyType): void {
    this.sun.delete(key);
  }

  clear(): void {
    this.sun.clear();
  }

  values(): Generator<[KeyType, RecordType]> {
    return this.sun.values();
  }

  find(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): Generator<[KeyType, RecordType]> {
    if (typeof this.sun.find !== 'function') {
      throw new Error('Find method not implemented');
    }
    return this.sun.find(query, value);
  }

  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | undefined | MutationAction,
  ): RecordType | undefined {
    return this.sun.mutate(key, (draft) => mutator(draft, this));
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
        'This collection cannot implement map: sun has no keys or map functions',
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
    // If the sun has a count method, use it
    if (typeof this.sun.count === 'function') {
      return this.sun.count();
    }

    // Throw an error if neither count nor keys is implemented
    throw new Error(`Count method not implemented for collection ${this.name}`);
  }

  /**
   * Get multiple records as a Map
   * @param keys Array of record keys to get
   * @returns Map of records
   */
  getMany(keys: KeyType[]): Map<KeyType, RecordType> {
    const map = new Map<KeyType, RecordType>();
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        map.set(key, value);
      }
    }
    return map;
  }

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany(recordMap: Map<KeyType, RecordType>): void {
    // If the sun has a setMany method, use it
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

  [Symbol.iterator](): Iterator<[KeyType, RecordType]> {
    return this.values();
  }
}
