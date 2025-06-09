import { produce } from 'immer';
import { MUTATION_ACTIONS } from '../constants';
import { isMutatorAction, isObj } from '../typeguards.multiverse';
import type { CollSyncIF } from '../types.coll';
import type { MutatorSync, SunIF } from '../types.multiverse';
import { applyFieldFilters } from './applyFieldFilters';
import { SunMemory } from './SunMemory';

/**
 * A Sun implementation that uses Immer for immutable state management
 */
export class SunMemoryImmer<RecordType, KeyType = string> extends SunMemory<
  RecordType,
  KeyType
> {
  #locked: boolean = false;

  set(key: KeyType, record: RecordType) {
    if (!this.coll) {
      throw new Error('SunMemoryImmer: collection not set');
    }
    if (this.#locked) {
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

    try {
      this.validate(processedRecord);
    } catch (err) {
      console.error('failed SMI validation:', record, processedRecord, err);
      throw err;
    }
    super.set(key, processedRecord);
  }

  mutate(
    key: KeyType,
    mutator: MutatorSync<RecordType, KeyType>,
  ): RecordType | undefined {
    this.#locked = true;

    const current = this.get(key);

    const result = produce(current, (draft) => {
      return mutator(draft, this.coll);
    });
    this.#locked = false;
    if (result === undefined) {
      this.delete(key);
      return undefined;
    }

    if (isMutatorAction(result)) {
      switch (result.action) {
        case MUTATION_ACTIONS.DELETE:
          this.delete(key);
          return undefined;
        case MUTATION_ACTIONS.NOOP:
          return current;
      }
    }

    this.set(key, result);
    return result;
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

  deleteMany(keys: KeyType[]): void {
    if (this.#locked && !this._isMutating) {
      throw new Error('Cannot delete many while locked');
    }
    super.deleteMany(keys);
  }
}

export default function memoryImmerSunF<R, K>(
  coll?: CollSyncIF<R, K>,
): SunIF<R, K> {
  return new SunMemoryImmer<R, K>({
    schema: coll?.schema,
    coll,
  });
}
