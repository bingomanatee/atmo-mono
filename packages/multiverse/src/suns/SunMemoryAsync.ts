import { ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { MUTATION_ACTIONS, STREAM_ACTIONS } from '../constants';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import type { CollAsyncIF } from '../types.coll';
import type { MutationAction, SunIF, SunIfAsync } from '../types.multiverse';
import { matchesQuery } from '../utils.sun';
import { applyFieldFilters } from './applyFieldFilters';
import { SunBase } from './SunFBase';

export class SunMemoryAsync<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollAsyncIF<RecordType, KeyType>>
  implements SunIF<RecordType, KeyType>
{
  #batchSize = 30;
  #data: ExtendedMap<KeyType, RecordType>;

  constructor(coll: CollAsyncIF<RecordType, KeyType>) {
    super();
    this.coll = coll;
    this.#data = new ExtendedMap<KeyType, RecordType>();
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
   * @returns A promise that resolves when all callbacks have been called
   */
  async each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => void,
  ): Promise<void> {
    // Iterate through all records
    for (const [key, record] of this.#data.entries()) {
      await Promise.resolve(callback(record, key, this.coll));
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
  async map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) =>
      | RecordType
      | void
      | MutationAction
      | Promise<RecordType | void | MutationAction>,
  ): Promise<Map<KeyType, RecordType>> {
    const keys = await this.keys();

    const recordsAndKeys = await Promise.all(
      Array.from(keys).map(async (key: KeyType) => {
        const record = await this.get(key);
        const result = await mapper(record, key, this);
        return [key, result];
      }),
    );
    return new Map(Array.from(recordsAndKeys));
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

  async *values(): AsyncGenerator<[KeyType, RecordType]> {
    for (const [key, value] of this.#data) {
      yield [key, value];
    }
  }

  findAll() {
    return this;
  }
}

export default function memoryAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIfAsync<R, K> {
  return new SunMemoryAsync<R, K>(coll);
}
