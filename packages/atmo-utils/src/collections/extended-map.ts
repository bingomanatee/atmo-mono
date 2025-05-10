import { isEqual } from 'lodash-es';

/**
 * ExtendedMap - An extended Map that adds methods for searching, filtering, and reducing
 */
export class ExtendedMap<K, V> extends Map<K, V> {
  /**
   * Static find method that works on any Map or iterable
   *
   * @param map - The Map or iterable to search
   * @param args - Arguments to pass to the find method
   * @returns A new Map containing only the entries that match the criteria
   */
  static find<K, V>(
    map: Map<K, V> | Iterable<readonly [K, V]>,
    ...args: any[]
  ): Map<K, V> {
    // Convert to ExtendedMap and use instance method
    return new ExtendedMap<K, V>(map).find(...args);
  }

  /**
   * Static filter method that works on any Map or iterable
   *
   * @param map - The Map or iterable to filter
   * @param predicate - The function to test each entry
   * @returns A new Map containing only the entries that pass the test
   */
  static filter<K, V>(
    map: Map<K, V> | Iterable<readonly [K, V]>,
    predicate: (value: V, key: K, map: Map<K, V>) => boolean
  ): Map<K, V> {
    const mapObj = map instanceof Map ? map : new Map(map);

    return ExtendedMap.reduce(
      mapObj,
      (result, value, key) => {
        if (predicate(value, key, mapObj)) {
          result.set(key, value);
        }
        return result;
      },
      new Map<K, V>()
    );
  }

  /**
   * Static reduce method that works on any Map or iterable
   *
   * @param map - The Map or iterable to reduce
   * @param callback - The function to execute on each entry
   * @param initialValue - The initial value
   * @returns The reduced value
   */
  static reduce<K, V, R>(
    map: Map<K, V> | Iterable<readonly [K, V]>,
    callback: (accumulator: R, value: V, key: K, map: Map<K, V>) => R,
    initialValue: R
  ): R {
    let accumulator = initialValue;
    const mapObj = map instanceof Map ? map : new Map(map);

    for (const [key, value] of mapObj.entries()) {
      accumulator = callback(accumulator, value, key, mapObj);
    }

    return accumulator;
  }

  findFirst(
    prop?: keyof V | ((value: V) => boolean),
    val?: any | ((value: V) => boolean)
  ): V | undefined {
    // If no criteria provided, return a copy of this map
    if (prop === undefined && val === undefined) {
      return undefined;
    }

    if (typeof prop === 'function') {
      for (const value of this.values()) {
        if (prop(value)) {
          return value;
        }
      }
      return undefined;
    }
    if (typeof val === 'function' && prop !== undefined) {
      for (const [key, value] of this.entries()) {
        const propValue = (value as any)[prop];
        if (val(propValue)) {
          return value;
        }
      }
      return undefined;
    }

    if (prop !== undefined && val !== undefined) {
      for (const [key, value] of this.entries()) {
        const propValue = (value as any)[prop];
        if (isEqual(propValue, val)) {
          return value;
        }
      }
      return undefined;
    }
    return undefined;
  }
  /**
   * Find entries in the map that match the given criteria
   *
   * @param prop - The property to search on, or a predicate function
   * @param val - The value to match, or a predicate function
   * @returns A new Map containing only the entries that match the criteria
   */
  find(
    prop?: keyof V | ((value: V) => boolean),
    val?: any | ((value: V) => boolean)
  ): Map<K, V> {
    // If no criteria provided, return a copy of this map
    if (prop === undefined && val === undefined) {
      return new Map(this);
    }

    // Create a new map to hold the results
    const result = new Map<K, V>();

    // Get the matching keys based on the criteria
    let matchingKeys: Set<K>;

    // If prop is a function, use it as a predicate
    if (typeof prop === 'function') {
      matchingKeys = this.findKeysByPredicate(prop);
    }
    // If val is a function and prop is a property name, use val as a filter on that property
    else if (typeof val === 'function' && prop !== undefined) {
      matchingKeys = this.findKeysByPredicate((value) => {
        const propValue = (value as any)[prop];
        return val(propValue);
      });
    }
    // If prop is a property name and val is defined, match by property
    else if (prop !== undefined && val !== undefined) {
      matchingKeys = this.findKeysByProperty(prop, val);
    }
    // Fallback: return empty map
    else {
      return new Map<K, V>();
    }

    // Add the matching entries to the result map
    for (const key of matchingKeys) {
      const value = this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Find keys in the map where the value has a property that matches the given value
   *
   * @param property - The property to match
   * @param value - The value to match
   * @returns A Set of keys that match the property value
   */
  protected findKeysByProperty(property: keyof V, value: any): Set<K> {
    const result = new Set<K>();

    for (const [key, val] of this.entries()) {
      const propValue = (val as any)[property];

      if (isEqual(propValue, value)) {
        result.add(key);
      }
    }

    return result;
  }

  /**
   * Find keys in the map where the value matches the given predicate
   *
   * @param predicate - The predicate function to match against
   * @returns A Set of keys that match the predicate
   */
  protected findKeysByPredicate(predicate: (value: V) => boolean): Set<K> {
    const result = new Set<K>();

    for (const [key, value] of this.entries()) {
      if (predicate(value)) {
        result.add(key);
      }
    }

    return result;
  }

  /**
   * Filter the map based on a predicate function
   *
   * @param predicate - The function to test each entry
   * @returns A new Map containing only the entries that pass the test
   */
  filter(predicate: (value: V, key: K, map: Map<K, V>) => boolean): Map<K, V> {
    return this.reduce((result, value, key) => {
      if (predicate(value, key, this)) {
        result.set(key, value);
      }
      return result;
    }, new Map<K, V>());
  }

  /**
   * Reduce the map to a single value
   *
   * @param callback - The function to execute on each entry
   * @param initialValue - The initial value
   * @returns The reduced value
   */
  reduce<R>(
    callback: (accumulator: R, value: V, key: K, map: Map<K, V>) => R,
    initialValue: R
  ): R {
    return ExtendedMap.reduce(this, callback, initialValue);
  }
}
