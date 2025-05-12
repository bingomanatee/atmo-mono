import { ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { produce } from 'immer';
import { MUTATION_ACTIONS } from '../constants';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
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
      this.validate(result);
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
    this.#locked = true;
    try {
      const record = await this.get(key);
      // note - the mutator has to be sync even thoul this is an async Sun.
      const result = produce(record, (draft: R) => mutator(draft, this.coll));
      this.#locked = false;
      return this.#afterMutate(result, key);
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
    result: R | void | MutationAction,
    key: K,
  ): Promise<R | undefined> {
    // Handle special actions
    if (isMutatorAction(result)) {
      return this.#processAction(result as MutationAction, key);
    }
    await this.set(key, result);
    return this.get(key);
  }

  async delete(key: K) {
    // If the collection is locked, queue the delete operation
    if (this.#locked) {
      throw new Error(
        'SnMemorymmmer: cannot delete during locked operation - usually during mutation',
      );
    }

    this.#data.delete(key);
  }

  clear() {
    // If the collection is locked, queue the clear operation
    if (this.#locked) {
      throw new Error(
        'SunMemoryImmerAsync: cannot clear during locked state - usually during mutation',
      );
    }

    this.#data.clear();
  }

  #processAction(action: MutationAction, key: K): void {
    switch (action.key) {
      case MUTATION_ACTIONS.DELETE:
        this.delete(key);
        return undefined;
        break;

      case MUTATION_ACTIONS.NOOP:
        break;
    }

    return this.get(key);
    // NOOP action does nothing
  }
}

export default function memoryImmerAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIfAsync<R, K> {
  return new SunMemoryImmerAsync<R, K>(coll);
}
