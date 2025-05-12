import type { MutationAction, SunIF, SunIFSync } from '../types.multiverse';
import type { CollSyncIF } from '../types.coll';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import { MUTATION_ACTIONS } from '../constants';
import { SunBase } from './SunFBase';
import { asError, ExtendedMap } from '@wonderlandlabs/atmo-utils';

export class SunMemory<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollSyncIF<RecordType, KeyType>>
  implements SunIFSync<RecordType, KeyType>
{
  // Private data storage
  #data: ExtendedMap<KeyType, RecordType>;

  constructor(coll: CollSyncIF<RecordType, KeyType>) {
    super();
    this.coll = coll;
    this.#data = new ExtendedMap();
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
    console.log('sun memory set', key, record, this._locked, this);
    if (this._locked) {
      throw new Error(
        'cannot set during locked operations - usually mutations',
      );
    }

    let existing = this.#data.get(key);

    this.validateInput(record);

    if (isObj(record)) {
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
          (record as { [fieldName]: any })[fieldName] = fieldValue;
        }
      }
    }

    if (this.coll.schema.filterRecord) {
      const filtered = this.coll.schema.filterRecord({
        currentRecord: existing,
        inputRecord: record,
      });
      this.#data.set(key, filtered as RecordType);
    } else this.#data.set(key, record);
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

  find(...args): RecordType[] {
    return this.#data.find(...args);
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

  getAll() {
    return new Map(this.#data);
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
    ) => RecordType | MutationAction,
  ): RecordType | undefined {
    // Lock the collection during mutation
    this._locked = true;

    try {
      const existing = this.#data.get(key);
      console.log('sun memory starting mutate', this._locked);
      const result = mutator(existing, this.coll);
      console.log('sun memory done with mutate', this._locked);
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
}

export default function memorySunF<R, K>(
  coll: CollSyncIF<R, K>,
): SunIFSync<R, K> {
  return new SunMemory<R, K>(coll);
}
