import { SunMemory } from '@wonderlandlabs/multiverse/src/suns/SunMemory';
import { SunIndex } from './SunIndex';
import type { CollSyncIF } from '@wonderlandlabs/multiverse/src/types.coll';

export class IndexedSun<
  RecordType extends Record<string, any> = any,
  ValueType = any,
> extends SunMemory<RecordType, string> {
  readonly #indexes: Map<string, SunIndex<RecordType, ValueType>> = new Map();
  #batchSize = 30;

  /**
   * Find records matching multiple criteria, using indexes for efficiency
   * @param criteria Array of [key, value] pairs to match
   * @returns Generator yielding batches of matching records
   */
  *find(
    ...criteria: [string, any][]
  ): Generator<Map<string, RecordType>, void, any> {
    if (criteria.length === 0) {
      throw new Error('At least one search criterion is required');
    }

    // Get or create index for first criterion
    const [firstKey, firstValue] = criteria[0];
    const index = this.#getIndex(firstKey);

    // If only one criterion, use index directly
    if (criteria.length === 1) {
      const results = new Map<string, RecordType>();
      for (const record of index.find(firstValue)) {
        results.set(record.id, record);
        if (results.size >= this.#batchSize) {
          yield results;
          results.clear();
        }
      }
      if (results.size > 0) {
        yield results;
      }
      return;
    }

    // For multiple criteria, filter the indexed results
    const remainingCriteria = criteria.slice(1);
    const results = new Map<string, RecordType>();
    for (const record of index.find(firstValue)) {
      // Check if record matches all remaining criteria
      const matchesAll = remainingCriteria.every(
        ([key, value]) => record[key] === value,
      );
      if (matchesAll) {
        results.set(record.id, record);
        if (results.size >= this.#batchSize) {
          yield results;
          results.clear();
        }
      }
    }
    if (results.size > 0) {
      yield results;
    }
  }

  /**
   * Get the set of keys for a specific value in an indexed field
   * @param field The field to look up
   * @param value The value to find keys for
   * @returns Set of keys or undefined if no matches
   */
  keysFor(field: keyof RecordType, value: ValueType): Set<string> | undefined {
    const index = this.#getIndex(field);
    return index.getKeysFor(value);
  }

  /**
   * Get or create an index for a field
   * @param field The field to index
   * @returns The index for the field
   */
  #getIndex(field: keyof RecordType): SunIndex<RecordType, ValueType> {
    const fieldStr = field as string;
    let index = this.#indexes.get(fieldStr);
    if (!index) {
      index = new SunIndex(this, fieldStr);
      this.#indexes.set(fieldStr, index);
    }
    return index;
  }

  /**
   * Override set to clear indexes
   */
  set(id: string, value: RecordType): void {
    super.set(id, value);
    this.#clearAllIndexes();
  }

  /**
   * Override delete to clear indexes
   */
  delete(id: string): void {
    super.delete(id);
    this.#clearAllIndexes();
  }

  /**
   * Clear all indexes
   */
  #clearAllIndexes(): void {
    for (const index of this.#indexes.values()) {
      index.clear();
    }
  }
}
