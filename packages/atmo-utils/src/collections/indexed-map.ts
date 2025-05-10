import { ExtendedMap } from './extended-map.ts';

/**
 * IndexedMap - Extends ExtendedMap and adds indexing for more efficient searching.
 * Indexes are automatically invalidated when the map is modified.
 */
export class IndexedMap<K, V> extends ExtendedMap<K, V> {
  /**
   * Maximum number of indexes to store
   * Each instance can have its own limit
   * If set to 0, indexing is disabled
   */
  private _maxIndexes = 100;

  /**
   * Get the maximum number of indexes
   */
  get maxIndexes(): number {
    return this._maxIndexes;
  }

  /**
   * Set the maximum number of indexes
   * @param value The maximum number of indexes to store
   * Must be a whole positive number or zero
   * If set to 0, indexing is disabled
   */
  set maxIndexes(value: number) {
    // Ensure value is a whole positive number or zero
    const intValue = Math.floor(value);
    if (intValue < 0) {
      throw new Error('maxIndexes must be a whole positive number or zero');
    }
    this._maxIndexes = intValue;

    // If maxIndexes is set to 0, clear all indexes
    if (this._maxIndexes === 0 && this._indexes) {
      this._indexes.clear();
    }
  }

  // Store indexes for different search patterns - lazily created
  // Key format: "property:propName:value" -> Set of keys that match
  private _indexes?: Map<string, Set<K>>;

  /**
   * Get the indexes map, creating it if it doesn't exist
   * This makes indexes lazily created only when needed
   */
  private get indexes(): Map<string, Set<K>> {
    if (!this._indexes) {
      this._indexes = new Map<string, Set<K>>();
    }
    return this._indexes;
  }

  /**
   * Get the current indexes for testing purposes
   * @returns The current indexes map or undefined if not created yet
   */
  getIndexes(): Map<string, Set<K>> | undefined {
    return this._indexes;
  }

  /**
   * Get the current indexes for testing/inspection
   * Returns a copy of the indexes to prevent external modification
   */
  getIndexesForTesting(): Map<string, Set<K>> {
    // Create a deep copy of the indexes
    const copy = new Map<string, Set<K>>();
    if (this._indexes) {
      for (const [key, value] of this._indexes.entries()) {
        copy.set(key, new Set(value));
      }
    }
    return copy;
  }

  /**
   * Create a new IndexedMap
   *
   * @param entries - An iterable of key-value pairs to initialize the map with
   */
  constructor(entries?: Iterable<readonly [K, V]>) {
    super(entries);
  }

  /**
   * Static find method that works on any Map or iterable
   * Uses indexing for more efficient searching
   *
   * @param map - The Map or iterable to search
   * @param args - Arguments to pass to the find method
   * @returns A new Map containing only the entries that match the criteria
   */
  static find<K, V>(
    map: Map<K, V> | Iterable<readonly [K, V]>,
    ...args: any[]
  ): Map<K, V> {
    // Convert to IndexedMap and use instance method
    return new IndexedMap<K, V>(map).find(...args);
  }

  override set(key: K, value: V): this {
    super.set(key, value);
    this.invalidateIndexes();
    return this;
  }

  override delete(key: K): boolean {
    const result = super.delete(key);
    if (result) {
      this.invalidateIndexes();
    }
    return result;
  }

  override clear(): void {
    super.clear();
    this.invalidateIndexes();
  }

  // No need to override find - we'll just override the helper methods
  // The parent class's find method will call our overridden helper methods

  /**
   * Override the parent's findKeysByProperty method to use indexes
   *
   * @param property - The property to match
   * @param value - The value to match
   * @returns A Set of keys that match the property value
   */
  protected override findKeysByProperty(property: keyof V, value: any): Set<K> {
    // If maxIndexes is 0, bypass indexing entirely
    if (this.maxIndexes === 0) {
      return super.findKeysByProperty(property, value);
    }

    try {
      // Try to stringify the value to use as an index key
      JSON.stringify(value);

      // Create an index key for this search pattern
      const indexKey = `property:${String(property)}:${JSON.stringify(value)}`;

      // Check if we have an index for this search pattern
      let keys = this.getIndex(indexKey);

      // If not, create one
      if (!keys) {
        keys = new Set<K>();

        // Populate the index
        for (const [key, val] of this.entries()) {
          const propValue = (val as any)[property];

          if (this.isEqual(propValue, value)) {
            keys.add(key);
          }
        }

        // Store the index
        this.setIndex(indexKey, keys);
      }

      // Return the keys (already a Set)
      return keys;
    } catch (e) {
      // If any error occurs, fall back to the parent's implementation
      return super.findKeysByProperty(property, value);
    }
  }

  /**
   * Override the parent's findKeysByPredicate method
   * We don't index predicate searches because they can be arbitrary functions
   *
   * @param predicate - The predicate function to match against
   * @returns A Set of keys that match the predicate
   */
  override findKeysByPredicate(predicate: (value: V) => boolean): Set<K> {
    // Just use the parent's implementation
    return super.findKeysByPredicate(predicate);
  }

  /**
   * Check if a value matches all properties in a record
   *
   * @param value - The value to check
   * @param record - The record to match against
   * @returns Whether the value matches the record
   */
  private matchesRecord(value: V, record: Partial<V>): boolean {
    // Check each property in the record
    for (const prop in record) {
      if (Object.prototype.hasOwnProperty.call(record, prop)) {
        const recordValue = record[prop];
        const valueProperty = (value as any)[prop];

        // If the property doesn't match, return false
        if (!this.isEqual(valueProperty, recordValue)) {
          return false;
        }
      }
    }

    // All properties matched
    return true;
  }

  private getIndex(indexKey: string): Set<K> | undefined {
    // Make sure the indexes map exists
    if (!this._indexes) {
      this._indexes = new Map<string, Set<K>>();
    }
    return this._indexes.get(indexKey);
  }

  private setIndex(indexKey: string, keys: Set<K>): void {
    // Make sure the indexes map exists
    if (!this._indexes) {
      this._indexes = new Map<string, Set<K>>();
    }

    this._indexes.set(indexKey, keys);

    // Enforce the maxIndexes limit with FIFO eviction
    // Assumes Map keys are iterated in insertion order (true for modern JS)
    while (this._indexes.size > this.maxIndexes) {
      const oldestKey = this._indexes.keys().next().value;
      if (oldestKey) {
        this._indexes.delete(oldestKey);
      }
    }
  }

  private invalidateIndexes(): void {
    if (this._indexes) {
      this._indexes.clear();
    }
  }
}
