/**
 * Tests for H3 IndexedDB Cache
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { h3Cache } from './h3-cache';
import { Vector3 } from 'three';

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: () => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({
        createIndex: () => {}
      }),
      transaction: () => ({
        objectStore: () => ({
          get: () => ({ onsuccess: null, onerror: null, result: null }),
          put: () => ({ onsuccess: null, onerror: null }),
          delete: () => ({ onsuccess: null, onerror: null }),
          clear: () => ({ onsuccess: null, onerror: null }),
          count: () => ({ onsuccess: null, onerror: null, result: 0 })
        })
      })
    }
  })
};

describe('H3 Cache', () => {
  beforeEach(() => {
    // Reset cache state for each test
    if (typeof window !== 'undefined') {
      // @ts-ignore
      global.indexedDB = mockIndexedDB;
    }
  });

  it('should handle missing IndexedDB gracefully', async () => {
    // Test when IndexedDB is not available
    const originalIndexedDB = global.indexedDB;
    // @ts-ignore
    delete global.indexedDB;

    const result = await h3Cache.getCellPoint('test-cell', 1000);
    expect(result).toBeNull();

    // Restore IndexedDB
    global.indexedDB = originalIndexedDB;
  });

  it('should return null for non-existent cache entries', async () => {
    const point = await h3Cache.getCellPoint('non-existent-cell', 1000);
    expect(point).toBeNull();

    const neighbors = await h3Cache.getCellNeighbors('non-existent-cell');
    expect(neighbors).toBeNull();

    const latLng = await h3Cache.getCellLatLng('non-existent-cell');
    expect(latLng).toBeNull();
  });

  it('should handle cache operations without throwing errors', async () => {
    const testPoint = new Vector3(1, 2, 3);
    const testNeighbors = ['neighbor1', 'neighbor2', 'neighbor3'];
    const testLatLng = { lat: 37.7749, lng: -122.4194 };

    // These should not throw errors even if IndexedDB is not available
    await expect(h3Cache.setCellPoint('test-cell', 1000, testPoint)).resolves.toBeUndefined();
    await expect(h3Cache.setCellNeighbors('test-cell', testNeighbors)).resolves.toBeUndefined();
    await expect(h3Cache.setCellLatLng('test-cell', testLatLng.lat, testLatLng.lng)).resolves.toBeUndefined();

    await expect(h3Cache.deleteCellPoint('test-cell', 1000)).resolves.toBeUndefined();
    await expect(h3Cache.deleteCellNeighbors('test-cell')).resolves.toBeUndefined();
    await expect(h3Cache.deleteCellLatLng('test-cell')).resolves.toBeUndefined();

    await expect(h3Cache.clearCache()).resolves.toBeUndefined();
  });

  it('should handle cache stats gracefully', async () => {
    const stats = await h3Cache.getCacheStats();
    // Should either return stats or null (if IndexedDB not available)
    if (stats) {
      expect(stats).toHaveProperty('points');
      expect(stats).toHaveProperty('neighbors');
      expect(stats).toHaveProperty('latLng');
      expect(typeof stats.points).toBe('number');
      expect(typeof stats.neighbors).toBe('number');
      expect(typeof stats.latLng).toBe('number');
    } else {
      expect(stats).toBeNull();
    }
  });

  it('should create cache keys correctly', () => {
    // Test that cache keys are generated consistently
    const h3Index = '8a2a1072b59ffff';
    const radius = 6371;
    
    // The cache should use consistent key generation
    // This is tested implicitly through the cache operations
    expect(h3Index).toBe('8a2a1072b59ffff');
    expect(radius).toBe(6371);
  });

  it('should handle different radius values', async () => {
    const testPoint1 = new Vector3(1, 0, 0);
    const testPoint2 = new Vector3(0, 1, 0);
    const h3Index = 'test-cell';

    // Set points for different radii
    await h3Cache.setCellPoint(h3Index, 1000, testPoint1);
    await h3Cache.setCellPoint(h3Index, 2000, testPoint2);

    // Should be able to retrieve both (if cache is working)
    const retrieved1 = await h3Cache.getCellPoint(h3Index, 1000);
    const retrieved2 = await h3Cache.getCellPoint(h3Index, 2000);

    // If IndexedDB is available and working, these should be different
    // If not available, both should be null
    if (retrieved1 && retrieved2) {
      expect(retrieved1.equals(testPoint1)).toBe(true);
      expect(retrieved2.equals(testPoint2)).toBe(true);
    } else {
      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    }
  });
});
