/**
 * H3 IndexedDB Cache
 *
 * A singleton cache that stores H3 cell computations in IndexedDB for faster lookups.
 * Caches cell-to-point conversions and cell-to-neighbors data.
 * Uses the same 'idb' library as atmo-plates for consistency.
 */

import { Vector3 } from 'three';
import { openDB, IDBPDatabase } from 'idb';

interface H3CellPoint {
  h3Index: string;
  radius: number;
  x: number;
  y: number;
  z: number;
}

interface H3CellNeighbors {
  h3Index: string;
  neighbors: string[];
}

interface H3CellLatLng {
  h3Index: string;
  lat: number;
  lng: number;
}

class H3Cache {
  private db: IDBPDatabase | null = null;
  private dbName = 'h3-cache';
  private dbVersion = 1;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private cachingEnabled = true;

  // Store names
  private readonly STORE_CELL_POINTS = 'cellPoints';
  private readonly STORE_CELL_NEIGHBORS = 'cellNeighbors';
  private readonly STORE_CELL_LATLNG = 'cellLatLng';

  constructor() {
    this.canUseIndexedDB =
      typeof window !== 'undefined' && 'indexedDB' in window;
    // Only initialize if IndexedDB is available
    if (this.canUseIndexedDB) {
      this.initPromise = this.initialize();
    }
  }

  public canUseIndexedDB: boolean;

  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.db = await openDB(this.dbName, this.dbVersion, {
        upgrade: (db) => {
          // Create object stores
          if (!db.objectStoreNames.contains(this.STORE_CELL_POINTS)) {
            const pointStore = db.createObjectStore(this.STORE_CELL_POINTS, {
              keyPath: 'id',
            });
            pointStore.createIndex('h3Index', 'h3Index', { unique: false });
            pointStore.createIndex('radius', 'radius', { unique: false });
          }

          if (!db.objectStoreNames.contains(this.STORE_CELL_NEIGHBORS)) {
            db.createObjectStore(this.STORE_CELL_NEIGHBORS, {
              keyPath: 'h3Index',
            });
          }

          if (!db.objectStoreNames.contains(this.STORE_CELL_LATLNG)) {
            db.createObjectStore(this.STORE_CELL_LATLNG, {
              keyPath: 'h3Index',
            });
          }
        },
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize H3Cache:', error);
      this.db = null;
    }
  }

  private async ensureInitialized(): Promise<boolean> {
    if (!this.cachingEnabled || !this.initPromise) {
      return false;
    }

    await this.initPromise;
    return this.db !== null;
  }

  /**
   * Get cached cell-to-point conversion
   */
  async getCellPoint(h3Index: string): Promise<Vector3 | null> {
    if (!(await this.ensureInitialized())) {
      return null;
    }

    try {
      const result = await this.db!.get(this.STORE_CELL_POINTS, h3Index);

      if (result) {
        return new Vector3().copy(result);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache cell-to-point conversion
   */
  async setCellPoint(h3Index: string, point: Vector3): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      const data: H3CellPoint & { id: string } = {
        id: `${h3Index}-${radius}`,
        h3Index,
        x: point.x,
        y: point.y,
        z: point.z,
      };

      await this.db!.put(this.STORE_CELL_POINTS, data);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Delete cached cell point
   */
  async deleteCellPoint(h3Index: string, radius: number): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      const id = `${h3Index}-${radius}`;
      await this.db!.delete(this.STORE_CELL_POINTS, id);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get cached cell neighbors
   */
  async getCellNeighbors(h3Index: string): Promise<string[] | null> {
    if (!(await this.ensureInitialized())) {
      return null;
    }

    try {
      const result = await this.db!.get(this.STORE_CELL_NEIGHBORS, h3Index);

      if (result) {
        return result.neighbors;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache cell neighbors
   */
  async setCellNeighbors(h3Index: string, neighbors: string[]): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      const data: H3CellNeighbors = {
        h3Index,
        neighbors,
      };

      await this.db!.put(this.STORE_CELL_NEIGHBORS, data);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Delete cached cell neighbors
   */
  async deleteCellNeighbors(h3Index: string): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      await this.db!.delete(this.STORE_CELL_NEIGHBORS, h3Index);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get cached cell lat/lng
   */
  async getCellLatLng(
    h3Index: string,
  ): Promise<{ lat: number; lng: number } | null> {
    if (!(await this.ensureInitialized())) {
      return null;
    }

    try {
      const result = await this.db!.get(this.STORE_CELL_LATLNG, h3Index);

      if (result) {
        return { lat: result.lat, lng: result.lng };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache cell lat/lng
   */
  async setCellLatLng(
    h3Index: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      const data: H3CellLatLng = {
        h3Index,
        lat,
        lng,
      };

      await this.db!.put(this.STORE_CELL_LATLNG, data);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Delete cached cell lat/lng
   */
  async deleteCellLatLng(h3Index: string): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      await this.db!.delete(this.STORE_CELL_LATLNG, h3Index);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      await Promise.all([
        this.db!.clear(this.STORE_CELL_POINTS),
        this.db!.clear(this.STORE_CELL_NEIGHBORS),
        this.db!.clear(this.STORE_CELL_LATLNG),
      ]);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    points: number;
    neighbors: number;
    latLng: number;
  } | null> {
    if (!(await this.ensureInitialized())) {
      return null;
    }

    try {
      const [pointsCount, neighborsCount, latLngCount] = await Promise.all([
        this.db!.count(this.STORE_CELL_POINTS),
        this.db!.count(this.STORE_CELL_NEIGHBORS),
        this.db!.count(this.STORE_CELL_LATLNG),
      ]);

      return {
        points: pointsCount,
        neighbors: neighborsCount,
        latLng: latLngCount,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Enable or disable caching
   */
  setCachingEnabled(enabled: boolean): void {
    this.cachingEnabled = enabled;
  }

  /**
   * Check if caching is enabled
   */
  isCachingEnabled(): boolean {
    return this.cachingEnabled;
  }

  /**
   * Check if IndexedDB is available and cache is initialized
   */
  async isAvailable(): Promise<boolean> {
    return await this.ensureInitialized();
  }

  /**
   * Get cache configuration info
   */
  getCacheInfo(): {
    enabled: boolean;
    dbName: string;
    dbVersion: number;
  } {
    return {
      enabled: this.cachingEnabled,
      dbName: this.dbName,
      dbVersion: this.dbVersion,
    };
  }
}

// Export singleton instance
export const h3Cache = new H3Cache();
