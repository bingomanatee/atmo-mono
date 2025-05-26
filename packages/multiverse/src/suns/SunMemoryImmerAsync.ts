import { ExtendedMap } from '@wonderlandlabs/atmo-utils';
import { produce } from 'immer';
import { MUTATION_ACTIONS } from '../constants';
import { isMutatorAction, isObj, isColl } from '../typeguards.multiverse';
import type { CollAsyncIF, CollBaseIF } from '../types.coll';
import type { MutationAction, SunIF, SunIfAsync } from '../types.multiverse';
import { SunBase } from './SunFBase';
import { SunMemoryImmer } from './SunMemoryImmer';

// Helper function for tests
const delay = (fn: () => void) => setTimeout(fn, 0);

/**
 * An async Sun implementation that uses Immer for immutable state management
 */
export class SunMemoryImmerAsync<R, K>
  extends SunMemoryImmer<R, K>
  implements SunIF<R, K>
{
  #data = new ExtendedMap();
  #locked: boolean = false;

  constructor(coll?: CollAsyncIF<R, K>) {
    super(coll);
    this.#data = new ExtendedMap();
    this.#locked = false;
    if (coll) {
      this.coll = coll;
    }
  }

  async *values(): AsyncIterableIterator<[K, R]> {
    for (const [key, value] of this.#data.entries()) {
      yield [key, value];
    }
  }

  async *find(...query: any[]): AsyncIterableIterator<[K, R]> {
    const [field, value] = query;
    if (typeof field === 'function') {
      for (const [key, record] of this.#data.entries()) {
        if (field(record)) {
          yield [key, record];
        }
      }
    } else {
      for (const [key, record] of this.#data.entries()) {
        if (record[field] === value) {
          yield [key, record];
        }
      }
    }
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
  async mutateAsync(
    key: K,
    mutator: (
      draft: R | undefined,
      collection: CollAsyncIF<R, K>,
    ) => Promise<R | undefined | MutationAction>,
  ): Promise<R | undefined> {
    this._isMutating = true;
    try {
      const current = this.get(key);
      const result = await produce(current, async (draft) => {
        return mutator(draft, this.coll);
      });

      if (result === undefined) {
        this.delete(key);
        return undefined;
      }

      if (typeof result === 'object' && result !== null) {
        if ('action' in result) {
          switch (result.action) {
            case 'DELETE':
              this.delete(result.key ?? key);
              return undefined;
            case 'NOOP':
              return current;
          }
        }
      }

      this.set(key, result);
      return result;
    } finally {
      this._isMutating = false;
    }
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

  [Symbol.iterator]() {
    return this.#data.entries();
  }
}

export default function memoryImmerAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIfAsync<R, K> {
  return new SunMemoryImmerAsync<R, K>(coll);
}
