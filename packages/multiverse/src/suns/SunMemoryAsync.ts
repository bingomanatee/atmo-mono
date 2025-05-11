import type { SunIF } from '../types.multiverse';
import type { CollAsyncIF } from '../types.coll';
import { isObj, isPromiseLike } from '../typeguards.multiverse';
import { SunBase } from './SunFBase.ts';
import { MUTATION_ACTIONS, MutationAction } from '../constants';

export class SunMemoryAsync<R, K>
  extends SunBase<R, K, CollAsyncIF<R, K>>
  implements SunIF<R, K>
{
  #data: Map<K, R>;

  constructor(coll: CollAsyncIF<R, K>) {
    super();
    this.coll = coll;
    this.#data = new Map();
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
  async find(query: any): Promise<R[]> {
    const results: R[] = [];

    // Iterate through all records
    for (const [key, record] of this.#data.entries()) {
      // Simple matching logic - if query is an object, check if all properties match
      if (typeof query === 'object' && query !== null) {
        let matches = true;
        for (const prop in query) {
          if (Object.prototype.hasOwnProperty.call(query, prop)) {
            if ((record as any)[prop] !== query[prop]) {
              matches = false;
              break;
            }
          }
        }
        if (matches) {
          results.push(record);
        }
      }
      // If query is a function, use it as a predicate
      else if (typeof query === 'function') {
        if (await Promise.resolve(query(record))) {
          results.push(record);
        }
      }
    }

    return results;
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
   * @param noTransaction - If true, changes are applied immediately without transaction support
   * @returns A promise that resolves to the number of records processed
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  async map(
    mapper: (
      record: R,
      key: K,
      collection: CollAsyncIF<R, K>,
    ) => R | void | MutationAction | Promise<R | void | MutationAction>,
  ): Promise<number> {
    const keys = await this.keys();

    const recordsAndKeys = await Promise.all(
      Array.from(keys).map(async (key: KeyType) => {
        const record = this.get(key);
        return [key, mapper(record, key, this)];
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

    try {
      const existing = this.#data.get(key);

      // Create a deep clone of the existing record
      const draft = existing ? JSON.parse(JSON.stringify(existing)) : undefined;

      try {
        // Apply the mutator function
        const result = mutator(draft, this.coll);

        // Handle Promise-like result
        if (isPromiseLike(result)) {
          // Unlock the collection immediately for async operations
          this._locked = false;

          // Await the promise result without locking
          try {
            const asyncResult = await result;
            // Process the async result without locking
            return this.#afterMutate(key, asyncResult);
          } catch (error) {
            console.error(
              `Error in async mutation for key ${String(key)}:`,
              error,
            );
            throw error;
          }
        }

        // Process the synchronous result
        return this.#afterMutate(key, result);
      } catch (error) {
        // Log errors from the synchronous mutator
        console.error(`Error in mutation for key ${String(key)}:`, error);

        // Rethrow the error to the caller
        throw error;
      }
    } finally {
      // Ensure the collection is unlocked
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
  async #afterMutate(
    key: K,
    result: R | void | MutationAction,
  ): Promise<R | undefined> {
    try {
      // Handle special actions
      if (result && typeof result === 'object' && 'action' in result) {
        // Queue the action to be processed after unlocking
        this.#queueEvent(() => {
          try {
            this.#processAction(result as MutationAction);
          } catch (error) {
            console.error(
              `Error in processAction for key ${String(key)}:`,
              error,
            );
          }
        });

        // For DELETE action, return undefined
        if ((result as MutationAction).action === MUTATION_ACTIONS.DELETE) {
          return undefined;
        }

        // For NOOP action, return the current value
        if ((result as MutationAction).action === MUTATION_ACTIONS.NOOP) {
          return this.get(key);
        }

        // For other actions, return the current value
        return this.get(key);
      }

      // Set the result if it's not undefined
      if (result !== undefined) {
        // Queue the set operation to be processed after unlocking
        this.#queueEvent(() => {
          try {
            this.set(key, result as R);
          } catch (error) {
            console.error(`Error in queued set for key ${String(key)}:`, error);
          }
        });
      }

      // Return the result (will be the current value until the queued set is processed)
      return (result as R) || this.get(key);
    } catch (error) {
      // Log errors in afterMutate
      console.error(`Error in afterMutate for key ${String(key)}:`, error);

      // Rethrow the error
      throw error;
    }
  }
}

export default function memoryAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIF<R, K> {
  return new SunMemoryAsync<R, K>(coll);
}
