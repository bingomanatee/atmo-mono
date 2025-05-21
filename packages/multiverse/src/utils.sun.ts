/**
 * Utility functions for Sun implementations
 */

import type { DataKey, DataRecord } from './types.multiverse';
import { STREAM_ACTIONS } from './constants';
import { isObj } from './typeguards.multiverse';

/**
 * Check if a record matches a property/value pair query
 * @param record The record to check
 * @param key The key of the record
 * @param prop The property to check
 * @param value The value to match against
 * @returns True if the record matches, false otherwise
 */
export function matchesPropValue<RecordType = DataRecord, KeyType = DataKey>(
  record: RecordType,
  key: KeyType,
  prop: string,
  value: any,
): boolean {
  if (!isObj(record)) {
    return false;
  }

  return record[prop] === value;
}

/**
 * Check if a record matches an object query
 * @param record The record to check
 * @param key The key of the record
 * @param query The query object to match against
 * @returns True if the record matches, false otherwise
 */
export function matchesObjectQuery<RecordType = DataRecord, KeyType = DataKey>(
  record: RecordType,
  key: KeyType,
  query: Record<string, any>,
): boolean {
  if (!isObj(record)) {
    return false;
  }

  for (const [prop, value] of Object.entries(query)) {
    // Special case for array values (like { ids: [1, 2, 3] })
    if (Array.isArray(value) && prop === 'ids') {
      // If the key is in the ids array, it's a match
      if (value.includes(key)) {
        // This is a match, so we can skip checking other properties
        return true;
      } else {
        // If the key is not in the ids array, it's not a match
        return false;
      }
    }

    // Special case for userId property (common in many data models)
    if (prop === 'userId') {
      // Check both camelCase and snake_case versions of the property
      if (record.user_id !== undefined) {
        if (record.user_id !== value) {
          return false;
        }
        continue;
      } else if (record.userId !== undefined) {
        if (record.userId !== value) {
          return false;
        }
        continue;
      }
    }

    if (record[prop] !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a record matches a function query (predicate)
 * @param record The record to check
 * @param key The key of the record
 * @param predicate The function to use as a predicate
 * @returns True if the record matches, false otherwise
 */
export function matchesFunctionQuery<
  RecordType = DataRecord,
  KeyType = DataKey,
>(
  record: RecordType,
  key: KeyType,
  predicate: (record: RecordType, key: KeyType) => boolean,
): boolean {
  return predicate(record, key);
}

/**
 * Check if a record matches a query
 * @param record The record to check
 * @param key The key of the record
 * @param query The query to match against
 * @returns True if the record matches, false otherwise
 */
export function matchesQuery<RecordType = DataRecord, KeyType = DataKey>(
  record: RecordType,
  key: KeyType,
  query: any[],
): boolean {
  if (!Array.isArray(query)) {
    throw new Error('matchesQuery expects an array query');
  }
  const [a, b] = query;

  if (typeof a === 'function') {
    // If query is a function, use it as a predicate
    return matchesFunctionQuery(record, key, query[0]);
  }
  // Handle different query formats
  if (query.length === 2) {
    // Handle property/value pair format (e.g., find('status', 'active'))
    return matchesPropValue(record, key, a, b);
  } else if (isObj(a)) {
    return matchesObjectQuery(record, key, a);
  } else {
    // Otherwise, match all records
    return true;
  }
}

/**
 * Find records in a data map based on a query
 * @param dataMap The map containing the data
 * @param query The query to match against
 * @returns A generator that yields batches of matching records and can receive control signals
 */
export function* findInMap<RecordType = DataRecord, KeyType = DataKey>(
  dataMap: Map<KeyType, RecordType>,
  query: any,
): Generator<Map<KeyType, RecordType>, void, any> {
  // Default batch size
  const batchSize = 50;

  // Create batches of records
  let currentBatch = new Map<KeyType, RecordType>();
  let count = 0;

  // Iterate through all records in the map
  for (const [key, value] of dataMap.entries()) {
    // Check if the record matches the query
    if (matchesQuery(value, key, query)) {
      currentBatch.set(key, value);
      count++;

      // If we've reached the batch size, yield the batch
      if (count >= batchSize) {
        const feedback = yield currentBatch;

        // Reset for next batch
        currentBatch = new Map<KeyType, RecordType>();
        count = 0;

        // Check for termination signal
        if (feedback === STREAM_ACTIONS.TERMINATE) {
          return;
        }
      }
    }
  }

  // Yield any remaining records in the final batch
  if (currentBatch.size > 0) {
    yield currentBatch;
  }
}

/**
 * Convert a generator to a Map
 * @param generator The generator to convert
 * @returns A Map containing the generator's values
 */
export function generatorToMap<KeyType, ValueType>(
  generator: Generator<Map<KeyType, ValueType>, void, any>,
): Map<KeyType, ValueType> {
  const map = new Map<KeyType, ValueType>();

  let result = generator.next();
  while (!result.done) {
    // Merge the batch into the result map
    const batch = result.value;
    for (const [key, value] of batch.entries()) {
      map.set(key, value);
    }

    // Pass undefined to the generator to continue normally
    // (not terminating the stream)
    result = generator.next(undefined);
  }

  return map;
}
