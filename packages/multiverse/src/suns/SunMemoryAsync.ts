import type { SunIF } from '../types.multiverse';
import type { CollAsyncIF } from '../types.coll';
import { isObj } from '../typeguards.multiverse';
import { SunBase } from './SunFBase.ts';

export class SunMemoryAsync<R, K>
  extends SunBase<R, K, CollAsyncIF<R, K>>
  implements SunIF<R, K>
{
  #data: Map<K, R>;

  constructor(coll: CollAsyncIF<R, K>) {
    super();
    this.coll = coll;
    this.#data = new Map();
  }

  get(key: K) {
    return this.#data.get(key);
  }

  async has(key: K) {
    return this.#data.has(key);
  }

  async set(key: K, record: R) {
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

  async delete(key: K) {
    this.#data.delete(key);
  }

  clear() {
    this.#data.clear();
  }
}

export default function memoryAsyncSunF<R, K>(
  coll: CollAsyncIF<R, K>,
): SunIF<R, K> {
  return new SunMemoryAsync<R, K>(coll);
}
