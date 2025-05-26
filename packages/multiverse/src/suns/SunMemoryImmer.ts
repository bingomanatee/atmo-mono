import { SunMemory } from './SunMemory';
import { produce } from 'immer';
import { MUTATION_ACTIONS } from '../constants';
import { isMutatorAction, isObj, isColl } from '../typeguards.multiverse';
import type { CollSyncIF, CollIF } from '../types.coll';
import type { MutationAction, SunIF } from '../types.multiverse';
import { applyFieldFilters } from './applyFieldFilters';

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
export class SunMemoryImmer<RecordType, KeyType = string> extends SunMemory<
  RecordType,
  KeyType
> {
  #locked: boolean = false;
  #event$: SimpleEventEmitter = new SimpleEventEmitter();
  _isMutating: boolean = false;

  constructor(coll?: CollIF<RecordType, KeyType>) {
    super({ schema: coll?.schema, coll });
    this.#event$ = new SimpleEventEmitter();
    if (coll) {
      this.coll = coll;
    }
  }

  set(key: KeyType, record: RecordType) {
    if (!this.coll) {
      throw new Error('SunMemoryImmer: collection not set');
    }
    if (this.#locked && !this._isMutating) {
      throw new Error(
        'SunMemoryImmer: cannot set while record is locked - usually during mutation',
      );
    }

    let existing = this.get(key);
    let processedRecord = record;

    if (isObj(record)) {
      processedRecord = { ...record };
      processedRecord = applyFieldFilters(
        processedRecord,
        existing,
        this.coll.schema,
      );

      if (this.coll.schema.filterRecord) {
        processedRecord = this.coll.schema.filterRecord({
          currentRecord: existing,
          inputRecord: processedRecord,
        }) as RecordType;
      }
    }

    this.validate(processedRecord);
    super.set(key, processedRecord);
  }

  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollIF<RecordType, KeyType>,
    ) => RecordType | undefined | MutationAction,
  ): RecordType | undefined {
    this._isMutating = true;
    try {
      const current = this.get(key);
      const result = produce(current, (draft) => {
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

  mutateAsync(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollIF<RecordType, KeyType>,
    ) => Promise<RecordType | undefined | MutationAction>,
  ): Promise<RecordType | undefined> {
    this._isMutating = true;
    return mutator(this.get(key), this.coll)
      .then((result) => {
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
                return this.get(key);
            }
          }
        }

        this.set(key, result);
        return result;
      })
      .finally(() => {
        this._isMutating = false;
      });
  }

  delete(key: KeyType): void {
    if (this.#locked && !this._isMutating) {
      throw new Error('Cannot delete while locked');
    }
    super.delete(key);
  }

  clear(): void {
    if (this.#locked && !this._isMutating) {
      throw new Error('Cannot clear while locked');
    }
    super.clear();
  }
}

export function memoryImmerSunF<R, K>(coll?: CollSyncIF<R, K>): SunIF<R, K> {
  return new SunMemoryImmer<R, K>({
    schema: coll?.schema,
    coll,
  });
}
