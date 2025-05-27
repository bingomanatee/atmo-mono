import type { CollSyncIF } from '@wonderlandlabs/multiverse/src/types.coll';

// Simple isObj implementation to avoid external dependency
const isObj = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// Type that ensures synchronous get method
type SyncCollection<RecordType, KeyType> = Omit<
  CollSyncIF<RecordType, KeyType>,
  'get'
> & {
  get(key: KeyType): RecordType | undefined;
};

export class SunIndex<RecordType extends Record<string, any>, ValueType = any> {
  readonly #coll: SyncCollection<RecordType, string>;
  readonly #key: string;
  #cache: Map<ValueType, Set<string>> | null = null;

  constructor(coll: SyncCollection<RecordType, string>, key: string) {
    this.#coll = coll;
    this.#key = key;
  }

  /**
   * Find records by a specific value
   * @param value The value to match
   * @returns Generator yielding matching records
   */
  *find(value: ValueType): Generator<[string, RecordType]> {
    if (!this.#cache) {
      this.#build();
    }

    const matchingIds = this.#cache?.get(value);
    if (!matchingIds) return;

    for (const id of matchingIds) {
      const record = this.#coll.get(id);
      if (record) yield [id, record];
    }
  }

  /**
   * Get the set of keys for a specific value
   * @param value The value to find keys for
   * @returns Set of keys or undefined if no matches
   */
  getKeysFor(value: ValueType): Set<string> | undefined {
    if (!this.#cache) {
      this.#build();
    }
    return this.#cache?.get(value);
  }

  /**
   * Build the index from the collection
   */
  #build(): void {
    this.#cache = new Map();
    for (const [key, record] of this.#coll.values()) {
      this.#indexRecord(record);
    }
  }

  /**
   * Index a single record
   */
  #indexRecord(record: RecordType): void {
    if (!isObj(record) || !(this.#key in record)) return;
    const value = record[this.#key] as ValueType;
    if (!this.#cache!.has(value)) {
      this.#cache!.set(value, new Set());
    }
    this.#cache!.get(value)!.add(record.id);
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.#cache = null;
  }

  /**
   * Get all records as a generator of [key, value] pairs
   * @returns Generator yielding [key, value] pairs
   */
  *values(): Generator<[string, RecordType]> {
    return this.#coll.values();
  }
}
