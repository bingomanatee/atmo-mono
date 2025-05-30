import { ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { v4 as uuidv4 } from 'uuid';
import { MUTATION_ACTIONS, STREAM_ACTIONS } from '../constants';
import type { Pair, SchemaLocalIF } from '../type.schema';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import type { CollSyncIF } from '../types.coll';
import { CollName } from '../types.coll';
import type { MutationAction, SunIFSync } from '../types.multiverse';
import { matchesQuery } from '../utils.sun';
import { applyFieldFilters } from './applyFieldFilters';
import { SunBase } from './SunFBase';

export class SunMemory<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollSyncIF<RecordType, KeyType>>
  implements SunIFSync<RecordType, KeyType>
{
  readonly id: CollName;
  readonly isAsync = false;
  #data: ExtendedMap<KeyType, RecordType>;

  constructor(props: {
    schema: SchemaLocalIF<RecordType>;
    coll?: CollSyncIF<RecordType, KeyType>;
  }) {
    super();
    this.id = props.coll?.schema?.name ?? uuidv4();
    this.#data = new ExtendedMap();
    if (props.coll) {
      this.coll = props.coll;
    }
  }

  #batchSize = 30;

  /**
   * Get a record by key
   * @param key - The key of the record to get
   * @returns The record or undefined if not found
   */
  get(key: KeyType): RecordType | undefined {
    return this.#data.get(key);
  }

  has(key: KeyType) {
    return this.#data.has(key);
  }

  set(key: KeyType, record: RecordType) {
    if (!this.coll) {
      throw new Error('SunMemory: collection not set');
    }
    if (this._locked && !this._isMutating) {
      throw new Error(
        'cannot set during locked operations - usually mutations',
      );
    }

    let existing = this.#data.get(key);
    let processedRecord = record;

    // Only apply filters if the record is an object
    if (isObj(record)) {
      // Apply field filters first
      processedRecord = applyFieldFilters(record, existing, this.coll.schema);

      // Apply record filter if it exists
      if (this.coll.schema.filterRecord) {
        processedRecord = this.coll.schema.filterRecord({
          currentRecord: existing,
          inputRecord: processedRecord,
        }) as RecordType;
      }
    }

    // Store the processed record
    this.#data.set(key, processedRecord);
  }

  delete(key: KeyType) {
    // If the collection is locked and not in a mutation, queue the delete operation
    if (this._locked && !this._isMutating) {
      throw new Error('cannot delete during lock -- usually during mutation');
    }

    this.#data.delete(key);
  }

  clear() {
    if (this._locked && !this._isMutating) {
      throw new Error('cannot clear during lock -- usually during mutation');
    }

    this.#data.clear();
  }

  /**
   * Get all keys in the collection
   * @returns An array of keys
   */
  keys(): KeyType[] {
    return Array.from(this.#data.keys());
  }

  /**
   * Find records matching a query
   * @param query The query to match against
   * @returns A generator of Pair<KeyType, RecordType> for matching records
   */
  *find(...query: any[]): Generator<Pair<KeyType, RecordType>> {
    for (const [key, value] of this.#data.entries()) {
      if (matchesQuery(value, key, query)) {
        yield [key, value];
      }
    }
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
    // Iterate through all records
    for (const [key, record] of this.#data.entries()) {
      callback(record, key, this.coll);
    }
  }

  /**
   * Get the number of records in the collection
   * @returns The number of records
   */
  count(): number {
    return this.#data.size;
  }

  /**
   * Get multiple records as a generator of [key, value] pairs
   * @param keys Array of record keys to get
   * @returns A generator of [key, value] pairs for matching records
   */
  *getMany(keys: KeyType[]): Generator<[KeyType, RecordType]> {
    for (const key of keys) {
      const value = this.#data.get(key);
      if (value !== undefined) {
        yield [key, value];
      }
    }
  }

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany(recordMap: Map<KeyType, RecordType>) {
    if (this._locked) {
      throw new Error(
        'cannot set during locked operations - usually mutations',
      );
    }

    let count = 0;
    for (const [key, record] of recordMap.entries()) {
      this.set(key, record);
      count++;
    }
  }

  deleteMany(keys: KeyType[]): void {
    if (this._locked) {
      throw new Error(
        'cannot delete during locked operations - usually mutations',
      );
    }

    for (const key of keys) {
      this.delete(key);
    }
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
    ) => RecordType | void | MutationAction,
    noTransaction?: boolean,
  ): Map<KeyType, RecordType> {
    const map = new Map<KeyType, RecordType>();
    for (const [key, record] of this.#data.entries()) {
      const result = mapper(record, key, this.coll);
      if (result !== undefined) {
        map.set(key, result as RecordType);
      }
    }
    return map;
  }

  /**
   * Mutate a record using a simple deep clone approach
   *
   * @param key - The key of the record to mutate
   * @param mutator - A function that accepts the previous record (or undefined) and the collection, and returns a new record or a mutation action
   * @returns The mutated record or undefined if deleted
   */
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | MutationAction,
  ): RecordType | undefined {
    if (this._locked) {
      throw new Error('Cannot mutate while locked');
    }

    this._locked = true;
    try {
      const current = this.get(key);
      const result = mutator(current, this.coll);
      this._locked = false;
      if (isMutatorAction(result)) {
        if (result.action === MUTATION_ACTIONS.DELETE) {
          const keyToDelete = result.key ?? key;
          this.delete(keyToDelete);
          return undefined;
        } else if (result.action === MUTATION_ACTIONS.NOOP) {
          return current;
        }
      }

      this.set(key, result);
      return result;
    } finally {
      this._locked = false;
    }
  }

  *values(): Generator<Pair<KeyType, RecordType>> {
    for (const [key, value] of this.#data.entries()) {
      yield [key, value];
    }
  }

  /**
   * Get all records as a generator of [key, value] pairs (alias for values)
   * @returns A generator of [key, value] pairs for all records
   * @deprecated Use values() instead
   */
  getAll(): Generator<Pair<KeyType, RecordType>> {
    return this.values();
  }

  [Symbol.iterator](): Iterator<Pair<KeyType, RecordType>> {
    return this.values();
  }

  get name(): CollName {
    return this.id;
  }

  send(key: KeyType, target: string): any {
    throw new Error('Method not implemented.');
  }

  sendAll(props: any): any {
    throw new Error('Method not implemented.');
  }

  sendMany(keys: KeyType[], props: any): any {
    throw new Error('Method not implemented.');
  }

  _afterMutate(action: MutationAction): any {
    switch (action) {
      case STREAM_ACTIONS.CREATE:
        return this.values();
      case STREAM_ACTIONS.UPDATE:
        return this.values();
      case STREAM_ACTIONS.DELETE:
        return this.values();
      default:
        return undefined;
    }
  }

  findCount(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): number {
    if (typeof query === 'function') {
      let count = 0;
      for (const record of this.#data.values()) {
        if (query(record)) {
          count++;
        }
      }
      return count;
    }

    let count = 0;
    for (const record of this.#data.values()) {
      if (record[query] === value) {
        count++;
      }
    }
    return count;
  }
}

export default function memorySunF<R, K>(
  coll?: CollSyncIF<R, K>,
): SunIFSync<R, K> {
  return new SunMemory({
    schema: coll?.schema,
    coll,
  });
}
