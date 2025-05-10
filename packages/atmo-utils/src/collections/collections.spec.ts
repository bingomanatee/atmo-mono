import { describe, it, expect } from 'vitest';
import { ExtendedMap } from './extended-map.ts';
import { IndexedMap } from './indexed-map.ts';

describe('Collection Classes', () => {
  describe('ExtendedMap', () => {
    it('should return a copy of the map when no criteria is provided', () => {
      const map = new ExtendedMap<string, number>();
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 1);

      const result = map.find();

      // Check that result is a Map
      expect(result).toBeInstanceOf(Map);

      // Check that it has all the entries from the original map
      expect(result.size).toBe(3);
      expect(result.get('a')).toBe(1);
      expect(result.get('b')).toBe(2);
      expect(result.get('c')).toBe(1);

      // Check that it's a new map, not the original
      map.set('d', 1);
      expect(result.has('d')).toBe(false);
      expect(map.size).toBe(4);
      expect(result.size).toBe(3);
    });

    it('should find items by property and return a new map', () => {
      interface Person {
        name: string;
        age: number;
      }

      const map = new ExtendedMap<string, Person>();
      map.set('p1', { name: 'Alice', age: 30 });
      map.set('p2', { name: 'Bob', age: 25 });
      map.set('p3', { name: 'Charlie', age: 30 });

      const result = map.find('age', 30);

      // Check that result is a Map
      expect(result).toBeInstanceOf(Map);

      // Check that it has the correct entries
      expect(result.size).toBe(2);
      expect(result.get('p1')?.name).toBe('Alice');
      expect(result.get('p3')?.name).toBe('Charlie');
      expect(result.has('p2')).toBe(false);

      // Check that the values are the same objects as in the original map
      expect(result.get('p1')).toBe(map.get('p1'));
      expect(result.get('p3')).toBe(map.get('p3'));
    });

    it('should find items by individual properties', () => {
      interface Person {
        name: string;
        age: number;
        city: string;
      }

      const map = new ExtendedMap<string, Person>();
      map.set('p1', { name: 'Alice', age: 30, city: 'New York' });
      map.set('p2', { name: 'Bob', age: 25, city: 'Boston' });
      map.set('p3', { name: 'Charlie', age: 30, city: 'New York' });

      // Find by age
      const resultByAge = map.find('age', 30);
      expect(resultByAge.size).toBe(2);
      expect(resultByAge.has('p1')).toBe(true);
      expect(resultByAge.has('p3')).toBe(true);

      // Find by city
      const resultByCity = map.find('city', 'New York');
      expect(resultByCity.size).toBe(2);
      expect(resultByCity.has('p1')).toBe(true);
      expect(resultByCity.has('p3')).toBe(true);
    });

    it('should find items by predicate', () => {
      const map = new ExtendedMap<string, number>();
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.set('d', 4);

      const result = map.find((value) => value % 2 === 0);

      expect(result.size).toBe(2);
      expect(result.has('b')).toBe(true);
      expect(result.has('d')).toBe(true);
    });

    it('should find items using a property name and a function', () => {
      interface Person {
        name: string;
        age: number;
      }

      const map = new ExtendedMap<string, Person>();
      map.set('p1', { name: 'Alice', age: 30 });
      map.set('p2', { name: 'Bob', age: 25 });
      map.set('p3', { name: 'Charlie', age: 35 });
      map.set('p4', { name: 'David', age: 40 });

      // Find people whose age is greater than 30
      const result = map.find('age', (age: number) => age > 30);

      expect(result.size).toBe(2);
      expect(result.has('p3')).toBe(true);
      expect(result.has('p4')).toBe(true);
      expect(result.has('p1')).toBe(false);
      expect(result.has('p2')).toBe(false);
    });

    it('should filter items using the filter method', () => {
      const map = new ExtendedMap<string, number>();
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.set('d', 4);

      const result = map.filter((value) => value % 2 === 0);

      expect(result.size).toBe(2);
      expect(result.get('b')).toBe(2);
      expect(result.get('d')).toBe(4);
      expect(result.has('a')).toBe(false);
      expect(result.has('c')).toBe(false);
    });

    it('should reduce items using the reduce method', () => {
      const map = new ExtendedMap<string, number>();
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 3);
      map.set('d', 4);

      const sum = map.reduce((acc, value) => acc + value, 0);

      expect(sum).toBe(10);
    });

    it('should use static methods on regular Maps', () => {
      const regularMap = new Map<string, number>();
      regularMap.set('a', 1);
      regularMap.set('b', 2);
      regularMap.set('c', 3);
      regularMap.set('d', 4);

      // Static find
      const foundItems = ExtendedMap.find(
        regularMap,
        (value: number) => value % 2 === 0,
      );
      expect(foundItems.size).toBe(2);
      expect(foundItems.get('b')).toBe(2);
      expect(foundItems.get('d')).toBe(4);

      // Static filter
      const filteredItems = ExtendedMap.filter(
        regularMap,
        (value) => value > 2,
      );
      expect(filteredItems.size).toBe(2);
      expect(filteredItems.get('c')).toBe(3);
      expect(filteredItems.get('d')).toBe(4);

      // Static reduce
      const sum = ExtendedMap.reduce(
        regularMap,
        (acc, value) => acc + value,
        0,
      );
      expect(sum).toBe(10);
    });
  });

  describe('IndexedMap', () => {
    it('should find items by value using indexes', () => {
      const map = new IndexedMap<string, number>();
      map.set('a', 1);
      map.set('b', 2);
      map.set('c', 1);

      // First search creates the index
      const result1 = map.find((value) => value === 1);
      expect(result1.size).toBe(2);
      expect(result1.has('a')).toBe(true);
      expect(result1.has('c')).toBe(true);

      // Second search uses the index
      const result2 = map.find((value) => value === 1);
      expect(result2.size).toBe(2);
      expect(result2.has('a')).toBe(true);
      expect(result2.has('c')).toBe(true);
    });

    it('should invalidate indexes when the map is modified', () => {
      interface TestObj {
        value: number;
      }

      const map = new IndexedMap<string, TestObj>();
      map.set('a', { value: 1 });
      map.set('b', { value: 2 });

      // Initially, no indexes should exist
      expect(map.getIndexes()).toBeUndefined();

      // Create the index using a property search
      map.find('value', 1);

      // Now indexes should exist
      const indexes1 = map.getIndexes();
      expect(indexes1).toBeDefined();
      expect(indexes1?.size).toBe(1);

      // Get the first index key
      const indexKey = Array.from(indexes1?.keys() || [])[0];

      // The index should contain the key 'a'
      const indexSet = indexes1?.get(indexKey);
      expect(indexSet).toBeDefined();
      expect(indexSet?.has('a')).toBe(true);
      expect(indexSet?.has('b')).toBe(false);

      // Modify the map with set
      map.set('c', { value: 1 });

      // Indexes should be cleared
      expect(map.getIndexes()?.size).toBe(0);

      // Create the index again
      map.find('value', 1);

      // Now indexes should exist again
      const indexes2 = map.getIndexes();
      expect(indexes2?.size).toBe(1);

      // The index should contain both 'a' and 'c'
      const indexSet2 = indexes2?.get(indexKey);
      expect(indexSet2).toBeDefined();
      expect(indexSet2?.has('a')).toBe(true);
      expect(indexSet2?.has('c')).toBe(true);

      // Modify the map with delete
      map.delete('a');

      // Indexes should be cleared
      expect(map.getIndexes()?.size).toBe(0);

      // Create the index again
      map.find('value', 1);

      // Now indexes should exist again
      const indexes3 = map.getIndexes();
      expect(indexes3?.size).toBe(1);

      // The index should contain 'c' but not 'a'
      const indexSet3 = indexes3?.get(indexKey);
      expect(indexSet3).toBeDefined();
      expect(indexSet3?.has('c')).toBe(true);
      expect(indexSet3?.has('a')).toBe(false);

      // Modify the map with clear
      map.clear();

      // Indexes should be cleared
      expect(map.getIndexes()?.size).toBe(0);

      // Create the index again
      map.find('value', 1);

      // Now indexes should exist again
      const indexes4 = map.getIndexes();
      expect(indexes4?.size).toBe(1);

      // The index should be empty
      const indexSet4 = indexes4?.get(indexKey);
      expect(indexSet4).toBeDefined();
      expect(indexSet4?.size).toBe(0);
    });

    it('should limit the number of indexes to maxIndexes', () => {
      // Create a map with a small maxIndexes for testing
      const map = new IndexedMap<string, number>();
      map.maxIndexes = 3;

      // Add test data
      for (let i = 0; i < 10; i++) {
        map.set(`key${i}`, i);
      }

      // Initially, no indexes should exist
      expect(map.getIndexes()).toBeUndefined();

      // Create more than maxIndexes indexes
      map.find('valueOf', 0);
      map.find('valueOf', 1);
      map.find('valueOf', 2);

      // Should have exactly 3 indexes
      expect(map.getIndexes()?.size).toBe(3);

      // Add more indexes
      map.find('valueOf', 3);

      // Should still have exactly 3 indexes (oldest one evicted)
      expect(map.getIndexes()?.size).toBe(3);

      // Add one more index
      map.find('valueOf', 4);

      // Should still have exactly 3 indexes (oldest one evicted)
      expect(map.getIndexes()?.size).toBe(3);
      // No need for finally block since we're using instance property
    });

    it('should bypass indexing when maxIndexes is 0', () => {
      // Create a map with maxIndexes set to 0
      const map = new IndexedMap<string, { id: number; name: string }>();
      map.maxIndexes = 0;

      // Add some items to the map
      map.set('key1', { id: 1, name: 'One' });
      map.set('key2', { id: 2, name: 'Two' });
      map.set('key3', { id: 3, name: 'Three' });

      // Perform a search by property
      const result = map.find('id', 2);

      // Verify the result
      expect(result.size).toBe(1);
      expect(result.has('key2')).toBe(true);

      // No indexes should be created
      expect(map.getIndexes()).toBeUndefined();

      // Perform another search
      const result2 = map.find('id', 1);

      // Verify the result
      expect(result2.size).toBe(1);
      expect(result2.has('key1')).toBe(true);

      // Still no indexes should be created
      expect(map.getIndexes()).toBeUndefined();
    });

    it('should create indexes on demand for property searches', () => {
      const map = new IndexedMap<string, { id: number; name: string }>();

      // Add some items to the map
      map.set('key1', { id: 1, name: 'One' });
      map.set('key2', { id: 2, name: 'Two' });
      map.set('key3', { id: 3, name: 'Three' });

      // Initially, no indexes should exist
      expect(map.getIndexes()).toBeUndefined();

      // Perform a search by property
      const result = map.find('id', 2);

      // Verify the result
      expect(result.size).toBe(1);
      expect(result.has('key2')).toBe(true);
      console.log('property search indexes', map.getIndexes());
      // Now an index should exist
      const indexes = map.getIndexes();
      expect(indexes).toBeDefined();
      expect(indexes?.size).toBe(1);

      // Get the first index key
      const indexKey = Array.from(indexes?.keys() || [])[0];

      // The index should exist
      expect(indexKey).toBeDefined();

      // The index should contain the key we found
      const indexSet = indexes?.get(indexKey);
      expect(indexSet).toBeDefined();
      expect(indexSet?.has('key2')).toBe(true);
      expect(indexSet?.has('key1')).toBe(false);
      expect(indexSet?.has('key3')).toBe(false);
    });

    it('should handle nested properties in indexes', () => {
      interface Person {
        name: string;
        address: {
          city: string;
          country: string;
        };
      }

      const map = new IndexedMap<string, Person>();
      map.set('p1', {
        name: 'Alice',
        address: { city: 'New York', country: 'USA' },
      });
      map.set('p2', {
        name: 'Bob',
        address: { city: 'London', country: 'UK' },
      });
      map.set('p3', {
        name: 'Charlie',
        address: { city: 'New York', country: 'USA' },
      });

      // Use a predicate function to search for people in New York, USA
      const result = map.find(
        (person) =>
          person.address.city === 'New York' &&
          person.address.country === 'USA',
      );

      expect(result.size).toBe(2);
      expect(result.has('p1')).toBe(true);
      expect(result.has('p3')).toBe(true);
    });

    it('should validate maxIndexes value', () => {
      const map = new IndexedMap<string, number>();

      // Should accept positive integers
      expect(() => {
        map.maxIndexes = 10;
      }).not.toThrow();
      expect(map.maxIndexes).toBe(10);

      // Should accept zero
      expect(() => {
        map.maxIndexes = 0;
      }).not.toThrow();
      expect(map.maxIndexes).toBe(0);

      // Should floor decimal values
      expect(() => {
        map.maxIndexes = 5.7;
      }).not.toThrow();
      expect(map.maxIndexes).toBe(5);

      // Should throw for negative values
      expect(() => {
        map.maxIndexes = -1;
      }).toThrow();
    });

    it('should use static find method on regular Maps', () => {
      const regularMap = new Map<string, number>();
      regularMap.set('a', 1);
      regularMap.set('b', 2);
      regularMap.set('c', 1);

      const result = IndexedMap.find(
        regularMap,
        (value: number) => value === 1,
      );

      expect(result.size).toBe(2);
      expect(result.has('a')).toBe(true);
      expect(result.has('c')).toBe(true);
      expect(result.has('b')).toBe(false);
    });
  });
});
