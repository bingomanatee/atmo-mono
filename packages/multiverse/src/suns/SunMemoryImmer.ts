import { produce } from 'immer';
import { MUTATION_ACTIONS } from '../constants';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import type { CollSyncIF } from '../types.coll';
import type { MutationAction, SunIF } from '../types.multiverse';
import { SunBase } from './SunFBase.ts';

// Helper function for tests
const delay = (fn: () => void) => setTimeout(fn, 0);

// Simple event emitter for tests
class SimpleEventEmitter {
  private listeners: Array<(data: any) => void> = [];

  subscribe(listener: (data: any) => void): { unsubscribe: () => void } {
    this.listeners.push(listener);
    return {
      unsubscribe: () => {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  next(data: any): void {
    this.listeners.forEach((listener) => listener(data));
  }
}

/**
 * A Sun implementation that uses Immer for immutable state management
 */
export class SunMemoryImmer<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollSyncIF<RecordType, KeyType>>
  implements SunIF<RecordType, KeyType>
{
  #data: Map<KeyType, RecordType>;
  #locked: boolean = false;
  #event$: SimpleEventEmitter = new SimpleEventEmitter();

  constructor(coll: CollSyncIF<RecordType, KeyType>) {
    super();
    this.coll = coll;
    this.#data = new Map();

    // Subscribe to the event subject to process events
    this.#event$.subscribe((event) => {
      // Use delay to ensure events are processed in the next tick
      delay(() => {
        // Execute the event
        event();
      });
    });
  }

  /**
   * Add an event to the queue
   * @param event - Function to execute
   * @private
   */
  #queueEvent(event: () => void): void {
    // Emit the event to the subject
    this.#event$.next(event);
  }

  get(key: KeyType) {
    return this.#data.get(key);
  }

  has(key: KeyType) {
    return this.#data.has(key);
  }

  set(key: KeyType, record: RecordType) {
    // If the collection is locked, queue the set operation
    if (this.#locked) {
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
      this.#data.set(key, filtered as RecordType);
    } else this.#data.set(key, input);
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
    this.#locked = true;

    try {
      const existing = this.#data.get(key);

      // Apply the mutator function
      const result = produce(existing, (draft) => mutator(draft, this.coll));
      this.#locked = false;
      if (isMutatorAction(result)) {
        return this.#afterMutate(key, result);
      } else {
        this.set(key, result);
        return this.get(key);
      }
    } finally {
      // Unlock the collection
      this.#locked = false;
    }
  }

  /**
   * Process the result of a mutation
   * @param key - The key of the record
   * @param result - The result of the mutation
   * @returns The final record value or undefined if deleted
   * @private
   */
  #afterMutate(
    key: KeyType,
    result: RecordType | void | MutationAction,
  ): RecordType | undefined {
    // Handle special actions
    if (isMutatorAction(result)) {
      return this.#processAction(result, key);
    }
    return this.get(key);
  }

  delete(key: KeyType) {
    // If the collection is locked, queue the delete operation
    if (this.#locked) {
      this.#queueEvent(() => this.delete(key));
      return;
    }

    this.#data.delete(key);
  }

  clear() {
    // If the collection is locked, queue the clear operation
    if (this.#locked) {
      this.#queueEvent(() => this.clear());
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
   * Process a mutation action
   * @param action - The action to process
   * @private
   */
  #processAction(action: MutationAction, key: KeyType): void {
    switch (action.action) {
      case MUTATION_ACTIONS.DELETE:
        if (action.key !== undefined) {
          // Use the key from the action to delete the record
          this.delete(action.key);
        }
        break;
      case MUTATION_ACTIONS.LOCK:
        this.#locked = true;
        break;
      case MUTATION_ACTIONS.UNLOCK:
        this.#locked = false;
        break;
      case MUTATION_ACTIONS.NOOP:
        return this.get(key);
        break;
    }
  }
}

export default function memoryImmerSunF<R, K>(
  coll: CollSyncIF<R, K>,
): SunIF<R, K> {
  return new SunMemoryImmer<R, K>(coll);
}
