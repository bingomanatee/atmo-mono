import type { PlateletIF } from '../types.PlateSimulation';
import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import type { RawPlatelet } from '../types.PlateSimulation';
import { h3ToVector } from 'h3-js';

export class Platelet implements PlateletIF {
  id: string;
  plateId: string;
  planetId: string;
  private _position: Vector3;
  radius: number;
  thickness: number;
  density: number;
  sector: string;

  constructor(data: Partial<PlateletIF> = {}) {
    this.id = data.id ?? uuidV4();
    this.plateId = data.plateId ?? uuidV4();
    this.planetId = data.planetId ?? uuidV4();
    this._position = new Vector3().copy(data.position ?? new Vector3(0, 0, 0));
    this.radius = data.radius ?? 1;
    this.thickness = data.thickness ?? 1;
    this.density = data.density ?? 1;
    this.sector = data.sector ?? '';
  }

  get position(): Vector3 {
    return this._position.clone();
  }

  set position(value: Vector3) {
    this._position = new Vector3().copy(value);
  }
}
