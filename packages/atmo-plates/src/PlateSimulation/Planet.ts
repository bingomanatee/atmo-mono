import {
  cellToLatLng,
  getH3CellForPosition,
  latLonToPoint,
  pointToLatLon,
} from '@wonderlandlabs/atmo-utils';
import { gridDisk } from 'h3-js';
import type { Vector3Like } from 'three';
import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import type { SimPlanetIF } from '../types.atmo-plates';

export class Planet implements SimPlanetIF {
  readonly id: string;
  readonly radius: number;
  readonly name?: string;
  #l0NeighborCache: Map<string, string[]> = new Map();
  #neighborPoints: Map<string, Vector3> = new Map();

  constructor(props: { id?: string; radius: number; name?: string }) {
    const { radius, name } = props;
    if (radius < 1000) {
      throw new Error('planet radii must be >= 1000km');
    }
    this.id = props.id || uuidV4();
    this.radius = radius;
    this.name = name;
  }

  /**
   * Get the 3D position of a cell's center, using cache if available
   */
  #neighborPoint(cell: string): Vector3 {
    if (!this.#neighborPoints.has(cell)) {
      const { lat, lng } = cellToLatLng(cell);
      // Convert to radians
      const latRad = (lat * Math.PI) / 180;
      const lngRad = (lng * Math.PI) / 180;
      // Calculate position on sphere
      const point = new Vector3(
        this.radius * Math.cos(latRad) * Math.cos(lngRad),
        this.radius * Math.sin(latRad),
        this.radius * Math.cos(latRad) * Math.sin(lngRad),
      );
      this.#neighborPoints.set(cell, point);
    }
    return this.#neighborPoints.get(cell)!;
  }

  /**
   * Get L0 neighbors for a cell, using cache if available
   */
  #getL0Neighbors(cell: string): string[] {
    if (!this.#l0NeighborCache.has(cell)) {
      const neighbors = gridDisk(cell, 1);
      this.#l0NeighborCache.set(cell, neighbors);
    }
    return this.#l0NeighborCache.get(cell)!;
  }

  /**
   * Find the nearest L0 cell to a given position
   */
  findNearestL0Cell(position: Vector3Like): string {
    return this.getH0CellForPosition(position);
  }

  /**
   * Get the H3 cell for a given position at specified resolution
   */
  getH3CellForPosition(position: Vector3Like, resolution: number = 0): string {
    return getH3CellForPosition(
      new Vector3(position.x, position.y, position.z),
      this.radius,
      resolution,
    );
  }

  /**
   * Get the H0 cell for a given position
   */
  getH0CellForPosition(position: Vector3Like): string {
    return this.getH3CellForPosition(position, 0);
  }

  /**
   * Convert a position to lat/lon coordinates
   */
  positionToLatLon(position: Vector3Like): { lat: number; lng: number } {
    const { lat, lon } = pointToLatLon(
      new Vector3(position.x, position.y, position.z),
    );
    return { lat, lng: lon };
  }

  /**
   * Convert lat/lon coordinates to a position on the planet surface
   */
  latLonToPosition(lat: number, lng: number): Vector3 {
    return latLonToPoint(
      (lat * Math.PI) / 180,
      (lng * Math.PI) / 180,
      this.radius,
    );
  }

  /**
   * Convert to a plain object for storage
   */
  toJSON(): SimPlanetIF {
    return {
      id: this.id,
      radius: this.radius,
      name: this.name,
    };
  }

  /**
   * Create a Planet instance from a plain object
   */
  static fromJSON(data: SimPlanetIF): Planet {
    return new Planet(data);
  }
}
