import { ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { MUTATION_ACTIONS, STREAM_ACTIONS } from '../constants';
import { isMutatorAction, isObj, isColl } from '../typeguards.multiverse';
import type { CollAsyncIF } from '../types.coll';
import type { MutationAction, SunIF, SunIfAsync } from '../types.multiverse';
import { matchesQuery } from '../utils.sun';
import { applyFieldFilters } from './applyFieldFilters';
import { SunBase } from './SunFBase';

export class SunMemoryAsync<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollAsyncIF<RecordType, KeyType>>
  implements SunIfAsync<RecordType, KeyType>
{
  #batchSize = 30; // Default batch size for parallel processing
  #data: ExtendedMap<KeyType, RecordType>;

  constructor(coll?: CollAsyncIF<RecordType, KeyType>) {
    super();
    this.#data = new ExtendedMap<KeyType, RecordType>();
    if (coll) {
      this.coll = coll;
    }
  }

  async init(coll?: CollAsyncIF<RecordType, KeyType>): Promise<void> {
    super.init(coll);
  }

  async get(key: KeyType) {
    return this.#data.get(key);
  }

  async has(key: KeyType) {
    return this.#data.has(key);
  }

  async set(key: KeyType, record: RecordType) {
    // If the collection is locked, queue the set operation
    if (this._locked) {
      throw new Error('cannot set when locked - usually during mutation');
    }

    let existing = this.#data.get(key);
    let processedRecord = record;

    // Apply field filters first
    if (isObj(record)) {
      processedRecord = applyFieldFilters(
        { ...record },
        existing,
        this.coll.schema,
      );
    }

    // Apply record filter if it exists
    if (this.coll.schema.filterRecord) {
      processedRecord = this.coll.schema.filterRecord({
        currentRecord: existing,
        inputRecord: processedRecord,
      }) as RecordType;
    }

    // Validate after all filters have been applied
    this.validate(processedRecord);

    // Store the processed record
    this.#data.set(key, processedRecord);
  }

  async delete(key: KeyType) {
    // If the collection is locked, queue the delete operation
    if (this._locked) {
      throw new Error('cannot delete when locked - usually during a mutation');
    }

    this.#data.delete(key);
  }

  async clear() {
    // If the collection is locked, queue the clear operation
    if (this._locked) {
      throw new Error(
        'cannot clear while collection is locked - usually during mutation',
      );
    }

    this.#data.clear();
  }

  /**
   * Get all keys in the collection
   * @returns A promise that resolves to an array of keys
   */
  async keys(): Promise<KeyType[]> {
    return Array.from(this.#data.keys());
  }

  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns A promise that resolves to an array of records matching the query
   */
  async *find(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): AsyncGenerator<[KeyType, RecordType]> {
    if (typeof query === 'function') {
      for (const [key, record] of this.#data.entries()) {
        if (query(record)) {
          yield [key, record];
        }
      }
      return;
    }

    for (const [key, record] of this.#data.entries()) {
      if (record[query] === value) {
        yield [key, record];
      }
    }
  }

  async findCount(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): Promise<number> {
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

  /**
   * Iterate over each record in the collection using parallel processing with batching
   * @param callback - Function to call for each record
   * @param batchSize - Optional batch size for parallel processing (defaults to 30)
   * @returns A promise that resolves when all callbacks have been called
   */
  async each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => void | Promise<void>,
    batchSize?: number,
  ): Promise<void> {
    const entries = Array.from(this.#data.entries());
    const effectiveBatchSize = batchSize ?? this.#batchSize;

    // For small collections, process all at once
    if (entries.length <= effectiveBatchSize) {
      await Promise.all(
        entries.map(([key, record]) =>
          Promise.resolve(callback(record, key, this.coll)),
        ),
      );
      return;
    }

    // For large collections, process in batches to prevent memory overload
    for (let i = 0; i < entries.length; i += effectiveBatchSize) {
      const batch = entries.slice(i, i + effectiveBatchSize);
      await Promise.all(
        batch.map(([key, record]) =>
          Promise.resolve(callback(record, key, this.coll)),
        ),
      );
    }
  }

  /**
   * Get the number of records in the collection
   * @returns A promise that resolves to the number of records
   */
  async count(): Promise<number> {
    return this.#data.size;
  }

  /**
   * Map over each record in the collection and apply a transformation
   * @param mapper - Function to transform each record
   * @returns A promise that resolves to the number of records processed
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  async *map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) =>
      | RecordType
      | void
      | MutationAction
      | Promise<RecordType | void | MutationAction>,
  ): AsyncGenerator<[KeyType, RecordType]> {
    const keys = await this.keys();

    for (const key of keys) {
      const record = await this.get(key);
      if (record !== undefined) {
        const result = await mapper(record, key, this.coll);
        if (result !== undefined) {
          yield [key, result as RecordType];
        }
      }
    }
  }

  /**
   * Process a mutation action
   * @param action - The action to process
   * @private
   */
  #processAction(action: MutationAction): void {
    if (action.action === MUTATION_ACTIONS.DELETE) {
      if (action.key !== undefined) {
        // Use the key from the action to delete the record
        this.delete(action.key);
      }
    } else if (action.action === MUTATION_ACTIONS.LOCK) {
      this._locked = true;
    } else if (action.action === MUTATION_ACTIONS.UNLOCK) {
      this._locked = false;
    }
    // NOOP action does nothing
  }

  /**
   * Mutate a record using a simple deep clone approach
   *
   * @param key - The key of the record to mutate
   * @param mutator - A function that accepts the previous record (or undefined) and the collection, and returns a new record or a mutation action
   * @returns A promise that resolves to the mutated record or undefined if deleted
   */
  async mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) =>
      | RecordType
      | void
      | MutationAction
      | Promise<RecordType | void | MutationAction>,
  ): Promise<RecordType | undefined> {
    // Lock the collection during synchronous part of mutation
    this._locked = true;
    const value = await this.get(key);
    if (value === undefined) {
      console.error('cannot find ', key, 'in', this.#data);
      throw new Error(`cannot mutate ${key} - not found`);
    }
    const result = await mutator(value, this.coll);

    return this.#afterMutate(key, result);
  }

  /**
   * Process the result of a mutation
   * @param key - The key of the record
   * @param result - The result of the mutation
   * @returns The final record value or undefined if deleted
   * @private
   */
  async #afterMutate(
    key: KeyType,
    result: RecordType | void | MutationAction,
  ): Promise<RecordType | undefined> {
    this._locked = false;
    if (!isMutatorAction(result)) {
      await this.set(key, result);
      return this.get(key);
    }

    switch (result.action) {
      case MUTATION_ACTIONS.DELETE:
        {
          await this.delete(key);
          return undefined;
        }
        break;

      case MUTATION_ACTIONS.NOOP: {
        return this.get(key);
      }
    }
  }

  /**
   * Get multiple records as a map
   * @param keys Array of record keys to get
   * @returns A promise that resolves to a map of key-value pairs for matching records
   */
  async getMany(keys: KeyType[]): Promise<Map<KeyType, RecordType>> {
    const result = new Map<KeyType, RecordType>();
    for (const key of keys) {
      const value = await this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   */
  async setMany(recordMap: Map<KeyType, RecordType>): Promise<void> {
    if (this._locked) {
      throw new Error(
        'cannot set during locked operations - usually mutations',
      );
    }

    for (const [key, record] of recordMap.entries()) {
      await this.set(key, record);
    }
  }

  /**
   * Delete multiple records by their keys
   * @param keys Array of record keys to delete
   */
  async deleteMany(keys: KeyType[]): Promise<void> {
    if (this._locked) {
      throw new Error(
        'cannot delete during locked operations - usually mutations',
      );
    }

    for (const key of keys) {
      await this.delete(key);
    }
  }

  async *values(): AsyncGenerator<[KeyType, RecordType]> {
    for (const [key, value] of this.#data) {
      yield [key, value];
    }
  }

  /**
   * Get all records as an async generator of [key, value] pairs (alias for values)
   * @returns An async generator of [key, value] pairs for all records
   * @deprecated Use values() instead
   */
  getAll(): AsyncGenerator<[KeyType, RecordType]> {
    return this.values();
  }

  [Symbol.iterator](): Iterator<[KeyType, RecordType]> {
    // For async generators, we need to return a sync iterator that yields promises
    const entries = Array.from(this.#data.entries());
    return entries[Symbol.iterator]();
  }

  findAll() {
    return this;
  }
}

export function memoryAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIfAsync<R, K> {
  return new SunMemoryAsync<R, K>(coll);
}
