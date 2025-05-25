import { asError, ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { MUTATION_ACTIONS, STREAM_ACTIONS } from '../constants';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import type { CollSyncIF } from '../types.coll';
import type { MutationAction, SunIFSync } from '../types.multiverse';
import { matchesQuery } from '../utils.sun';
import { applyFieldFilters } from './applyFieldFilters';
import { SunBase } from './SunFBase';

export class SunMemory<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollSyncIF<RecordType, KeyType>>
  implements SunIFSync<RecordType, KeyType>
{
  // Private data storage
  #data: ExtendedMap<KeyType, RecordType>;
  id: string;

  constructor(coll: CollSyncIF<RecordType, KeyType>) {
    super();
    this.coll = coll;
    this.#data = new ExtendedMap();
    this.id = 'sun' + Math.random();
  }

  #batchSize = 30;

  /**
   * Get a record by key
   * @param key - The key of the record to get
   * @returns The record or undefined if not found
   */

  get(key: KeyType) {
    return this.#data.get(key);
  }

  has(key: KeyType) {
    return this.#data.has(key);
  }

  set(key: KeyType, record: RecordType) {
    if (this._locked) {
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

    // Skip validation here since it's now done at the collection level

    // Store the processed record
    this.#data.set(key, processedRecord);
  }

  delete(key: KeyType) {
    // If the collection is locked, queue the delete operation
    if (this._locked) {
      throw new Error('cannot delete during lock -- usually during mutation');
    }

    this.#data.delete(key);
  }

  clear() {
    if (this._locked) {
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
   * @returns A generator of {key, value} pairs for matching records
   */
  /**
   * Find records matching a query
   * @param query The query to match against
   * @returns A generator that yields batches of matching records
   */
  *find(...query: any[]): Generator<[KeyType, RecordType]> {
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
   * Get multiple records as a generator of batches
   * @param keys Array of record keys to get
   * @returns Generator that yields batches of records and can receive control signals
   */
  *getMany(keys: KeyType[]): Generator<Map<KeyType, RecordType>, void, any> {
    // Create batches of records
    let currentBatch: Map<KeyType, RecordType>;
    //@TODO: find?
    // Yield each record from the keys array
    for (const key of keys) {
      const value = this.#data.get(key);
      if (!currentBatch) {
        currentBatch = new Map();
      }
      currentBatch.set(key, value);

      // If we've reached the batch size, yield the batch
      if (currentBatch.size >= this.#batchSize) {
        const feedback = yield currentBatch;

        // Reset for next batch
        currentBatch = new Map<KeyType, RecordType>();

        // Check for termination signal
        if (feedback === STREAM_ACTIONS.TERMINATE) {
          return;
        }
      }
    }

    if (!currentBatch) {
      yield new Map();
    } else if (currentBatch.size) {
      yield currentBatch;
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
  ): Map<KeyType, RecordType> {
    // If noTransaction is true, apply changes immediately
    const map = new Map();

    try {
      this.#data.forEach((record, key) => {
        map.set(key, mapper(record, key, this.coll));
      });
    } catch (err) {
      const error = asError(err);
      error.successCount = map.size;
      throw error;
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
    // Lock the collection during mutation
    this._locked = true;

    try {
      const existing = this.#data.get(key);
      const result = mutator(existing, this.coll);
      this._locked = false;
      return this._afterMutate(key, result);
    } finally {
      // Unlock the collection
      this._locked = false;
    }
  }

  /**
   * Process the result of a mutation
   * @param key - The key of the record
   * @param result - The result of the mutation
   * @returns The final record value or undefined if deleted
   * @private
   */
  protected _afterMutate(
    key: KeyType,
    result: RecordType | MutationAction,
  ): RecordType | undefined {
    // Handle special actions
    if (isMutatorAction(result)) {
      // For DELETE action, return undefined
      if ((result as MutationAction).action === MUTATION_ACTIONS.DELETE) {
        this.delete(key);
        return undefined;
      }

      // For NOOP action, return the current value
      if ((result as MutationAction).action === MUTATION_ACTIONS.NOOP) {
        return this.get(key);
      }
    }
    this.set(key, result);
    return this.get(key); // should equal result but ...
  }

  *values(): Generator<Map<KeyType, RecordType>> {
    yield new Map(this.#data.entries());
  }
}

export default function memorySunF<R, K>(
  coll: CollSyncIF<R, K>,
): SunIFSync<R, K> {
  return new SunMemory<R, K>(coll);
}
