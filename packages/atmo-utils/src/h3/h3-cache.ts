/**
 * H3 IndexedDB Cache
 *
 * A singleton cache that stores H3 cell computations in IndexedDB for faster lookups.
 * Caches cell-to-point conversions and cell-to-neighbors data.
 */

import { Vector3 } from 'three';

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
  private db: IDBDatabase | null = null;
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
    // Only initialize if IndexedDB is available
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized || !this.initPromise) {
      return;
    }

    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object stores
          if (!db.objectStoreNames.contains(this.STORE_CELL_POINTS)) {
            const pointStore = db.createObjectStore(this.STORE_CELL_POINTS, {
              keyPath: 'id',
            });
            pointStore.createIndex('h3Index', 'h3Index', { unique: false });
            pointStore.createIndex('radius', 'radius', { unique: false });
          }

          if (!db.objectStoreNames.contains(this.STORE_CELL_NEIGHBORS)) {
            const neighborStore = db.createObjectStore(
              this.STORE_CELL_NEIGHBORS,
              { keyPath: 'h3Index' },
            );
          }

          if (!db.objectStoreNames.contains(this.STORE_CELL_LATLNG)) {
            const latLngStore = db.createObjectStore(this.STORE_CELL_LATLNG, {
              keyPath: 'h3Index',
            });
          }
        };
      });

      this.isInitialized = true;
    } catch (error) {
      // Silently fail if IndexedDB is not available
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
  async getCellPoint(h3Index: string, radius: number): Promise<Vector3 | null> {
    if (!(await this.ensureInitialized())) {
      return null;
    }

    try {
      const transaction = this.db!.transaction(
        [this.STORE_CELL_POINTS],
        'readonly',
      );
      const store = transaction.objectStore(this.STORE_CELL_POINTS);
      const id = `${h3Index}-${radius}`;

      const result = await new Promise<H3CellPoint | null>(
        (resolve, reject) => {
          const request = store.get(id);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        },
      );

      if (result) {
        return new Vector3(result.x, result.y, result.z);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache cell-to-point conversion
   */
  async setCellPoint(
    h3Index: string,
    radius: number,
    point: Vector3,
  ): Promise<void> {
    if (!(await this.ensureInitialized())) {
      return;
    }

    try {
      const transaction = this.db!.transaction(
        [this.STORE_CELL_POINTS],
        'readwrite',
      );
      const store = transaction.objectStore(this.STORE_CELL_POINTS);

      const data: H3CellPoint & { id: string } = {
        id: `${h3Index}-${radius}`,
        h3Index,
        radius,
        x: point.x,
        y: point.y,
        z: point.z,
      };

      store.put(data);
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
      const transaction = this.db!.transaction(
        [this.STORE_CELL_POINTS],
        'readwrite',
      );
      const store = transaction.objectStore(this.STORE_CELL_POINTS);
      const id = `${h3Index}-${radius}`;
      store.delete(id);
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
      const transaction = this.db!.transaction(
        [this.STORE_CELL_NEIGHBORS],
        'readonly',
      );
      const store = transaction.objectStore(this.STORE_CELL_NEIGHBORS);

      const result = await new Promise<H3CellNeighbors | null>(
        (resolve, reject) => {
          const request = store.get(h3Index);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        },
      );

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
      const transaction = this.db!.transaction(
        [this.STORE_CELL_NEIGHBORS],
        'readwrite',
      );
      const store = transaction.objectStore(this.STORE_CELL_NEIGHBORS);

      const data: H3CellNeighbors = {
        h3Index,
        neighbors,
      };

      store.put(data);
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
      const transaction = this.db!.transaction(
        [this.STORE_CELL_NEIGHBORS],
        'readwrite',
      );
      const store = transaction.objectStore(this.STORE_CELL_NEIGHBORS);
      store.delete(h3Index);
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
      const transaction = this.db!.transaction(
        [this.STORE_CELL_LATLNG],
        'readonly',
      );
      const store = transaction.objectStore(this.STORE_CELL_LATLNG);

      const result = await new Promise<H3CellLatLng | null>(
        (resolve, reject) => {
          const request = store.get(h3Index);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        },
      );

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
      const transaction = this.db!.transaction(
        [this.STORE_CELL_LATLNG],
        'readwrite',
      );
      const store = transaction.objectStore(this.STORE_CELL_LATLNG);

      const data: H3CellLatLng = {
        h3Index,
        lat,
        lng,
      };

      store.put(data);
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
      const transaction = this.db!.transaction(
        [this.STORE_CELL_LATLNG],
        'readwrite',
      );
      const store = transaction.objectStore(this.STORE_CELL_LATLNG);
      store.delete(h3Index);
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
      const transaction = this.db!.transaction(
        [
          this.STORE_CELL_POINTS,
          this.STORE_CELL_NEIGHBORS,
          this.STORE_CELL_LATLNG,
        ],
        'readwrite',
      );

      transaction.objectStore(this.STORE_CELL_POINTS).clear();
      transaction.objectStore(this.STORE_CELL_NEIGHBORS).clear();
      transaction.objectStore(this.STORE_CELL_LATLNG).clear();
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
      const transaction = this.db!.transaction(
        [
          this.STORE_CELL_POINTS,
          this.STORE_CELL_NEIGHBORS,
          this.STORE_CELL_LATLNG,
        ],
        'readonly',
      );

      const [pointsCount, neighborsCount, latLngCount] = await Promise.all([
        new Promise<number>((resolve, reject) => {
          const request = transaction
            .objectStore(this.STORE_CELL_POINTS)
            .count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }),
        new Promise<number>((resolve, reject) => {
          const request = transaction
            .objectStore(this.STORE_CELL_NEIGHBORS)
            .count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }),
        new Promise<number>((resolve, reject) => {
          const request = transaction
            .objectStore(this.STORE_CELL_LATLNG)
            .count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }),
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
