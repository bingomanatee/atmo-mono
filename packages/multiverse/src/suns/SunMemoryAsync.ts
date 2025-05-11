import { ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { MUTATION_ACTIONS } from '../constants';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import type { CollAsyncIF } from '../types.coll';
import type { MutationAction, SunIF } from '../types.multiverse';
import { SunBase } from './SunFBase.ts';

export class SunMemoryAsync<R, K>
  extends SunBase<R, K, CollAsyncIF<R, K>>
  implements SunIF<R, K>
{
  #data: ExtendedMap<K, R>;

  constructor(coll: CollAsyncIF<R, K>) {
    super();
    this.coll = coll;
    this.#data = new ExtendedMap<K, R>();
  }

  /**
   * Queue an event to be processed
   * @param event - Function to execute
   * @private
   */
  #queueEvent(event: () => void): void {
    // Use the protected method from SunBase
    this._queueEvent(event);
  }

  get(key: K) {
    return this.#data.get(key);
  }

  async has(key: K) {
    return this.#data.has(key);
  }

  async set(key: K, record: R) {
    // If the collection is locked, queue the set operation
    if (this._locked) {
      this.#queueEvent(() => this.set(key, record));
      return;
    }

    let existing = this.#data.get(key);
    const input = isObj(record) ? { ...record } : record;

    this.validateInput(input);

    for (const fieldName of Object.keys(this.coll.schema.fields)) {
      const field = this.coll.schema.fields[fieldName];

      if (field.filter) {
        const fieldValue: any = field.filter({
          currentRecord: existing,
          inputRecord: record,
          field: field,
          currentValue: isObj(existing)
            ? (existing as { [fieldName]: any })[fieldName]
            : undefined,
          newValue: isObj(record)
            ? (record as { [fieldName]: any })[fieldName]
            : undefined,
        });
        (input as { [fieldName]: any })[fieldName] = fieldValue;
      }
    }

    if (this.coll.schema.filterRecord) {
      const filtered = this.coll.schema.filterRecord({
        currentRecord: existing,
        inputRecord: input,
      });
      this.#data.set(key, filtered as R);
    } else this.#data.set(key, input);
  }

  async delete(key: K) {
    // If the collection is locked, queue the delete operation
    if (this._locked) {
      this.#queueEvent(() => this.delete(key));
      return;
    }

    this.#data.delete(key);
  }

  clear() {
    // If the collection is locked, queue the clear operation
    if (this._locked) {
      this.#queueEvent(() => this.clear());
      return;
    }

    this.#data.clear();
  }

  /**
   * Get all keys in the collection
   * @returns A promise that resolves to an array of keys
   */
  async keys(): Promise<K[]> {
    return Array.from(this.#data.keys());
  }

  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns A promise that resolves to an array of records matching the query
   */
  async find(...query: any[]): Promise<Map<K, R>> {
    return this.#data.find(...query);
  }

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   * @returns A promise that resolves when all callbacks have been called
   */
  async each(
    callback: (record: R, key: K, collection: CollAsyncIF<R, K>) => void,
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
      record: R,
      key: K,
      collection: CollAsyncIF<R, K>,
    ) => R | void | MutationAction | Promise<R | void | MutationAction>,
  ): Promise<Map<K, R>> {
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
    key: K,
    mutator: (
      draft: R | undefined,
      collection: CollAsyncIF<R, K>,
    ) => R | void | MutationAction | Promise<R | void | MutationAction>,
  ): Promise<R | undefined> {
    // Lock the collection during synchronous part of mutation
    this._locked = true;
    const value = await this.get(key);
    if (value === undefined) {
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
    key: K,
    result: R | void | MutationAction,
  ): Promise<R | undefined> {
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
}

export default function memoryAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIF<R, K> {
  return new SunMemoryAsync<R, K>(coll);
}
