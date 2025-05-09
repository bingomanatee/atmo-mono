import type { SunIF } from '../types.multiverse';
import { CollSyncIF } from '../types.coll';
import { isCollSchemaField, isObj } from '../typeguards.multiverse';

export class MemorySunF<R, K> implements SunIF<R, K> {
  #data: Map<K, R>;

  constructor(private coll: CollSyncIF<R, K>) {
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

    for (const fieldName in Object.keys(this.coll.schema)) {
      const field = this.coll.schema.fields[fieldName];
      if (isCollSchemaField(field) && field.filter && isObj(record)) {
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
