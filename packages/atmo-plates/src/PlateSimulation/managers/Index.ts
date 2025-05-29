import type { CollSync } from '@wonderlandlabs/multiverse';

export class Index<T> {
  readonly #engine: CollSync<T>;
  readonly #key: string;
  readonly #cache: Map<string, Set<string>> = new Map();

  constructor(engine: CollSync<T>, key: string) {
    this.#engine = engine;
    this.#key = key;
    this.#build();
  }

  /**
   * Build the index by scanning all records
   */
  #build(): void {
    this.#cache.clear();
    for (const [id, record] of this.#engine.entries()) {
      const value = String((record as Record<string, unknown>)[this.#key]);
      if (!this.#cache.has(value)) {
        this.#cache.set(value, new Set());
      }
      this.#cache.get(value)!.add(id);
    }
  }

  /**
   * Retrieve records matching a value
   * @param value The value to match
   * @returns Generator yielding matching records
   */
  *retrieve(value: any): Generator<T> {
    const matchingIds = this.#cache.get(String(value)) || new Set();
    for (const id of matchingIds) {
      const record = this.#engine.get(id);
      if (record) yield record;
    }
  }

  /**
   * Update the index for a single record
   */
  update(id: string, record: T): void {
    if (record && typeof record === 'object' && this.#key in record) {
      const value = String((record as Record<string, unknown>)[this.#key]);
      if (!this.#cache.has(value)) {
        this.#cache.set(value, new Set());
      }
      this.#cache.get(value)!.add(id);
    }
  }

  /**
   * Remove a record from the index
   */
  remove(id: string, record: T): void {
    if (record && typeof record === 'object' && this.#key in record) {
      const value = String((record as Record<string, unknown>)[this.#key]);
      const ids = this.#cache.get(value);
      if (ids) {
        ids.delete(id);
        if (ids.size === 0) {
          this.#cache.delete(value);
        }
      }
    }
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.#cache.clear();
  }

  /**
   * Rebuild the index from scratch
   */
  rebuild(): void {
    this.#build();
  }
}
