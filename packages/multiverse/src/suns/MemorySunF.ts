import type { SunIF } from '../types.multiverse';
import { CollSyncIF } from '../types.coll';

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

  set(key: K, value: R) {
    this.#data.set(key, value);
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
