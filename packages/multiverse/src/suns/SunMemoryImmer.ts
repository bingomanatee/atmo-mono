import { produce } from 'immer';
import { MUTATION_ACTIONS } from '../constants';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import type { CollBaseIF, CollSyncIF } from '../types.coll';
import type { MutationAction, SunIF, SunIFSync } from '../types.multiverse';
import { applyFieldFilters } from './applyFieldFilters';
import { SunBase } from './SunFBase';

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
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => void,
  ): void | Promise<void> {
    for (const [key, value] of this.#data) {
      callback(value, key, this.coll);
    }
  }
  count(): number | Promise<number> {
    return this.#data.size;
  }
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

  #batchSize: number = 30;
  *getMany(keys: KeyType[]): Generator<Map<KeyType, RecordType>> {
    let out: Map<KeyType, RecordType> | undefined;

    for (const key of keys) {
      const value = this.#data.get(key);
      if (value) {
        if (!out) {
          out = new Map();
        }
        out.set(key, value);
        if (out.size > this.#batchSize) {
          yield out;
          out.clear();
        }
      }
    }
    if (!out) {
      yield new Map();
    }
    if (out.size) {
      yield out;
    }
  }

  *values(): Generator<[KeyType, RecordType]> {
    for (const [key, value] of this.#data) {
      yield [key, value];
    }
  }

  map?(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollBaseIF,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ) {
    throw new Error('Method not implemented.');
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
      throw new Error(
        'SunMemoryImmer: cannot set while record is locked - usually during mutation',
      );
    }

    let existing = this.#data.get(key);
    let processedRecord = record;

    // Only apply filters if the record is an object
    if (isObj(record)) {
      // Create a shallow copy to avoid mutating the original
      processedRecord = { ...record };

      // Apply field filters first
      processedRecord = applyFieldFilters(
        processedRecord,
        existing,
        this.coll.schema,
      );

      // Apply record filter if it exists
      if (this.coll.schema.filterRecord) {
        processedRecord = this.coll.schema.filterRecord({
          currentRecord: existing,
          inputRecord: processedRecord,
        }) as RecordType;
      }
    }

    // Validate after all filters have been applied
    this.validate(processedRecord);

    // Store the processed record
    this.#data.set(key, processedRecord);
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
      throw new Error(
        'SunMemoryImmmer - cannot delete while locked - usually during mutation',
      );
    }

    this.#data.delete(key);
  }

  clear() {
    // If the collection is locked, queue the clear operation
    if (this.#locked) {
      throw new Error(
        'SunMemorImmer: cannot clear during locked stat - usually during mutation',
      );
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
   * @returns Generator yielding [key, value] pairs
   */
  *find(query: any): Generator<[KeyType, RecordType]> {
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
          yield [key, record];
        }
      }
      // If query is a function, use it as a predicate
      else if (typeof query === 'function') {
        if (query(record)) {
          yield [key, record];
        }
      }
    }
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
      case MUTATION_ACTIONS.NOOP:
        return this.get(key);
        break;
    }
  }
}

export default function memoryImmerSunF<R, K>(
  coll: CollSyncIF<R, K>,
): SunIFSync<R, K> {
  return new SunMemoryImmer<R, K>(coll);
}
