import type { SunIF } from '../types.multiverse';
import type { CollSyncIF } from '../types.coll';
import { isObj } from '../typeguards.multiverse';
import { MUTATION_ACTIONS, MutationAction } from '../constants';
import { SunBase } from './SunFBase';
import { asError } from '@wonderlandlabs/atmo-utils/src';

export class SunMemory<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollSyncIF<RecordType, KeyType>>
  implements SunIF<RecordType, KeyType>
{
  // Private data storage
  #data: Map<KeyType, RecordType>;

  constructor(coll: CollSyncIF<RecordType, KeyType>) {
    super();
    this.coll = coll;
    this.#data = new Map();
  }

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
    // If the collection is locked, queue the set operation
    if (this._locked) {
      this._queueEvent(() => this.set(key, record));
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
      this.#data.set(key, filtered as RecordType);
    } else this.#data.set(key, input);
  }

  delete(key: KeyType) {
    // If the collection is locked, queue the delete operation
    if (this._locked) {
      this._queueEvent(() => this.delete(key));
      return;
    }

    this.#data.delete(key);
  }

  clear() {
    // If the collection is locked, queue the clear operation
    if (this._locked) {
      this._queueEvent(() => this.clear());
      return;
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
   * @param query - The query to match against
   * @returns An array of records matching the query
   */
  find(query: any): RecordType[] {
    const results: RecordType[] = [];

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
        if (query(record)) {
          results.push(record);
        }
      }
    }

    return results;
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
        map.set(key, mapper(record, key, this));
      });
    } catch (err) {
      const error = asError(err);
      error.successCount = map.size;
      throw error;
    }

    return map;
  }

  /**
   * Process a mutation action
   * @param action - The action to process
   * @private
   */
  protected _processAction(action: MutationAction): void {
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
   * @returns The mutated record or undefined if deleted
   */
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) =>
      | RecordType
      | void
      | MutationAction
      | Promise<RecordType | void | MutationAction>,
  ): RecordType | undefined {
    // Lock the collection during mutation
    this._locked = true;

    try {
      const existing = this.#data.get(key);

      const result = mutator(existing, this);
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
    result: RecordType | void | MutationAction,
  ): RecordType | undefined {
    if (!result) return;

    // Handle special actions
    if (result && typeof result === 'object' && 'action' in result) {
      // For DELETE action, return undefined
      if ((result as MutationAction).action === MUTATION_ACTIONS.DELETE) {
        this.delete(key);
        return undefined;
      }

      // For NOOP action, return the current value
      if ((result as MutationAction).action === MUTATION_ACTIONS.NOOP) {
        return this.get(key);
      }
      this.set(key, result);
      return this.get(key); // should equal result but ...
    }
  }
}

export default function memorySunF<R, K>(coll: CollSyncIF<R, K>): SunIF<R, K> {
  return new SunMemory<R, K>(coll);
}
