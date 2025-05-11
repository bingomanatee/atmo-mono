import type { SunIF } from '../types.multiverse';
import type { CollSyncIF } from '../types.coll';
import { isObj } from '../typeguards.multiverse';
import { SunBase } from './SunFBase.ts';
import { MUTATION_ACTIONS, MutationAction } from '../constants';
import { produce } from 'immer';

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
export class SunMemoryImmer<R, K>
  extends SunBase<R, K, CollSyncIF<R, K>>
  implements SunIF<R, K>
{
  #data: Map<K, R>;
  #locked: boolean = false;
  #event$: SimpleEventEmitter = new SimpleEventEmitter();

  constructor(coll: CollSyncIF<R, K>) {
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

  get(key: K) {
    return this.#data.get(key);
  }

  has(key: K) {
    return this.#data.has(key);
  }

  set(key: K, record: R) {
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
      this.#data.set(key, filtered as R);
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
    key: K,
    mutator: (
      draft: R | undefined,
      collection: CollSyncIF<R, K>,
    ) => R | void | MutationAction | Promise<R | void | MutationAction>,
  ): R | undefined {
    // Lock the collection during mutation
    this.#locked = true;

    try {
      const existing = this.#data.get(key);

      // Apply the mutator function
      const result = produce(existing, (draft) => mutator(draft, this.coll));

      // Process the result
      return this.#afterMutate(key, result);
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
  #afterMutate(key: K, result: R | void | MutationAction): R | undefined {
    // Handle special actions
    if (result && typeof result === 'object' && 'action' in result) {
      // Queue the action to be processed after unlocking
      this.#queueEvent(() => this.#processAction(result as MutationAction));

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
      this.#queueEvent(() => this.set(key, result as R));
    }

    // Return the result (will be the current value until the queued set is processed)
    return (result as R) || this.get(key);
  }

  delete(key: K) {
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
  keys(): K[] {
    return Array.from(this.#data.keys());
  }

  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns An array of records matching the query
   */
  find(query: any): R[] {
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
  #processAction(action: MutationAction): void {
    if (action.action === MUTATION_ACTIONS.DELETE) {
      if (action.key !== undefined) {
        // Use the key from the action to delete the record
        this.delete(action.key);
      }
    } else if (action.action === MUTATION_ACTIONS.LOCK) {
      this.#locked = true;
    } else if (action.action === MUTATION_ACTIONS.UNLOCK) {
      this.#locked = false;
    }
    // NOOP action does nothing
  }
}

export default function memoryImmerSunF<R, K>(
  coll: CollSyncIF<R, K>,
): SunIF<R, K> {
  return new SunMemoryImmer<R, K>(coll);
}
