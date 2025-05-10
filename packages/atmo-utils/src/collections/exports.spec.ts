import { describe, it, expect } from 'vitest';
import { ExtendedMap, IndexedMap } from '../index.ts';

describe('Collection Exports', () => {
  it('should export ExtendedMap from the package root', () => {
    expect(ExtendedMap).toBeDefined();

    const map = new ExtendedMap<string, number>();
    map.set('a', 1);
    map.set('b', 2);

    const result = map.find((value) => value > 1);

    expect(result.size).toBe(1);
    expect(result.get('b')).toBe(2);
  });

  it('should export IndexedMap from the package root', () => {
    expect(IndexedMap).toBeDefined();

    const map = new IndexedMap<string, number>();
    map.set('a', 1);
    map.set('b', 2);

    const result = map.find((value) => value > 1);

    expect(result.size).toBe(1);
    expect(result.get('b')).toBe(2);
  });
});
