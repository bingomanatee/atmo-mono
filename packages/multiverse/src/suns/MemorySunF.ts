import type { FieldLocalIF, SunIF } from '../types.multiverse';
import { CollSyncIF } from '../types.coll';
import { isObj, isField } from '../typeguards.multiverse';
import { validateField } from '../utils/validateField';
import { SunBase } from './SunFBase.ts';

export class MemorySunF<R, K> extends SunBase<R, K> implements SunIF<R, K> {
  #data: Map<K, R>;

  constructor(protected coll: CollSyncIF<R, K>) {
    super();
    this.#data = new Map();
  }

  get(key: K) {
    return this.#data.get(key);
  }

  has(key: K) {
    return this.#data.has(key);
  }

  set(key: K, record: R) {
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
      } else {
        // console.info('no filter in ', field);
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

  delete(key: K) {
    this.#data.delete(key);
  }

  clear() {
    this.#data.clear();
  }
}

export default function memorySunF<R, K>(coll: CollSyncIF<R, K>): SunIF<R, K> {
  return new MemorySunF<R, K>(coll);
}
