import { ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { produce } from 'immer';
import { MUTATION_ACTIONS } from '../constants';
import { isObj } from '../typeguards.multiverse';
import type { CollAsyncIF, CollBaseIF } from '../types.coll';
import type { MutationAction, SunIF, SunIfAsync } from '../types.multiverse';
import { SunBase } from './SunFBase.ts';

// Helper function for tests
const delay = (fn: () => void) => setTimeout(fn, 0);

/**
 * An async Sun implementation that uses Immer for immutable state management
 */
export class SunMemoryImmerAsync<R, K>
  extends SunBase<R, K, CollAsyncIF<R, K>>
  implements SunIF<R, K>
{
  #data = new ExtendedMap();
  #locked: boolean = false;

  constructor(coll: CollAsyncIF<R, K>) {
    super();
    this.coll = coll;
  }

  async getAll() {
    return new Map(this.#data);
  }

  async find(...query: any[]): Promise<Map<K, R>> | R[] {
    return this.#data.find(...query);
  }

  async keys(): Promise<K[]> {
    return Array.from(this.#data.keys());
  }

  async map(
    mapper: (
      record: R,
      key: K,
      collection: CollBaseIF,
    ) => Promise<R | MutationAction>,
  ) {
    const keys = await this.keys();

    return new Map(
      // @ts-ignore
      keys.map(async (key) => {
        const value = await this.get(key);
        const updated = produce(value, (draft) => {
          return mapper(draft as R, key, this.coll);
        });
        return [key, updated];
      }),
    );
  }

  async get(key: K) {
    return this.#data.get(key);
  }

  async has(key: K) {
    return this.#data.has(key);
  }

  async set(key: K, record: R) {
    // If the collection is locked, queue the set operation
    if (this.#locked) {
      throw new Error(
        'cannot set a record if collection is locked (usually, by mutate)',
      );
      return;
    }

    let existing = this.#data.get(key);

    const result = produce(record, (draft) => {
      for (const fieldName of Object.keys(this.coll.schema.fields)) {
        const field = this.coll.schema.fields[fieldName];

        if (field.filter) {
          const fieldValue: any = field.filter({
            currentRecord: existing,
            inputRecord: draft,
            field: field,
            currentValue: isObj(existing)
              ? (existing as { [fieldName]: any })[fieldName]
              : undefined,
            newValue: isObj(record)
              ? (record as { [fieldName]: any })[fieldName]
              : undefined,
          });
          (draft as { [fieldName]: any })[fieldName] = fieldValue;
        }
      }
    });

    if (this.coll.schema.filterRecord) {
      const filtered = produce(result, (draft) =>
        this.coll.schema.filterRecord({
          currentRecord: existing,
          inputRecord: draft,
        }),
      );
      this.#data.set(key, filtered as R);
    } else {
      this.validateInput(result);
      this.#data.set(key, result);
    }
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
    this.#locked = true;

    try {
      this.#locked = false;
      // Process the synchronous result
      return this.#afterMutate(key, result);
    } finally {
      // Ensure the collection is unlocked
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
  async #afterMutate(
    key: K,
    result: R | void | MutationAction,
  ): Promise<R | undefined> {
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

  async delete(key: K) {
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

export default function memoryImmerAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIfAsync<R, K> {
  return new SunMemoryImmerAsync<R, K>(coll);
}
