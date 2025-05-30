import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import type { SimPlateIF } from '../types.atmo-plates';

export class Plate implements SimPlateIF {
  id: string;
  name: string;
  radius: number;
  density: number;
  thickness: number;
  private _position: Vector3;
  private _velocity: Vector3;
  planetId: string;
  isActive: boolean;

  // Extended properties
  area?: number;
  coveragePercent?: number;
  mass?: number;
  rank?: number;
  behavioralType?: 'continental-like' | 'oceanic-like' | 'transitional';

  constructor(data: Partial<SimPlateIF> = {}) {
    this.id = data.id ?? uuidV4();
    this.name = data.name ?? `plate-${this.id}`;

    // Radius must be provided - no default value
    if (data.radius === undefined) {
      throw new Error(
        `Plate radius is required and must be calculated by PlateSpectrumGenerator`,
      );
    }
    this.radius = data.radius;

    this.density = data.density ?? 2.8;
    this.thickness = data.thickness ?? 100;
    this.planetId = data.planetId ?? '';
    this.isActive = data.isActive ?? true;

    // Handle position - convert from plain object or Vector3
    if (data.position) {
      if (data.position instanceof Vector3) {
        this._position = data.position.clone();
      } else {
        this._position = new Vector3(
          data.position.x ?? 0,
          data.position.y ?? 0,
          data.position.z ?? 0,
        );
      }
    } else {
      this._position = new Vector3(0, 0, 0);
    }

    // Handle velocity - convert from plain object or Vector3
    if (data.velocity) {
      if (data.velocity instanceof Vector3) {
        this._velocity = data.velocity.clone();
      } else {
        this._velocity = new Vector3(
          data.velocity.x ?? 0,
          data.velocity.y ?? 0,
          data.velocity.z ?? 0,
        );
      }
    } else {
      this._velocity = new Vector3(0, 0, 0);
    }

    // Extended properties
    this.area = data.area;
    this.coveragePercent = data.coveragePercent;
    this.mass = data.mass;
    this.rank = data.rank;
    this.behavioralType = data.behavioralType;
  }

  get position(): Vector3 {
    return this._position.clone();
  }

  set position(value: Vector3 | { x: number; y: number; z: number }) {
    if (value instanceof Vector3) {
      this._position = value.clone();
    } else {
      this._position = new Vector3(value.x, value.y, value.z);
    }
  }

  get velocity(): Vector3 {
    return this._velocity.clone();
  }

  set velocity(value: Vector3 | { x: number; y: number; z: number }) {
    if (value instanceof Vector3) {
      this._velocity = value.clone();
    } else {
      this._velocity = new Vector3(value.x, value.y, value.z);
    }
  }

  /**
   * Convert to a plain object for storage
   */
  toJSON(): SimPlateIF {
    return {
      id: this.id,
      name: this.name,
      radius: this.radius,
      density: this.density,
      thickness: this.thickness,
      position: {
        x: this._position.x,
        y: this._position.y,
        z: this._position.z,
      },
      velocity: {
        x: this._velocity.x,
        y: this._velocity.y,
        z: this._velocity.z,
      },
      planetId: this.planetId,
      isActive: this.isActive,
      area: this.area,
      coveragePercent: this.coveragePercent,
      mass: this.mass,
      rank: this.rank,
      behavioralType: this.behavioralType,
    };
  }

  /**
   * Create a Plate instance from a plain object
   */
  static fromJSON(data: SimPlateIF): Plate {
    return new Plate(data);
  }
}
