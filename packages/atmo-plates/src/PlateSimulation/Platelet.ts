import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import type { PlateletIF } from './types.PlateSimulation';
import { PlateletManager } from './managers/PlateletManager';

export class Platelet implements PlateletIF {
  id: string;
  plateId: string;
  planetId: string;
  radius: number;
  thickness: number;
  density: number;
  sector: string;
  h3Cell: string;
  neighborCellIds: string[];

  constructor(data: Partial<PlateletIF> = {}) {
    let id = data.id;
    if (!id) {
      if (data.plateId && data.h3Cell) {
        id = PlateletManager.plateletId(data.plateId, data.h3Cell);
      } else {
        throw new Error('platelet requires id or plateId and h3Cell');
      }
    }
    this.id = id;
    this.h3Cell = data.h3Cell; // Use h3Cell from the interface
    if (!this.h3Cell) {
      throw new Error('platelet required h3Cell');
    }
    this.neighborCellIds = Array.isArray(data.neighborCellIds)
      ? data.neighborCellIds
      : [];
    this.plateId = data.plateId ?? uuidV4();
    this.planetId = data.planetId ?? uuidV4();
    this.position = new Vector3().copy(data.position ?? new Vector3(0, 0, 0));
    this.radius = data.radius ?? 1;
    this.thickness = data.thickness ?? 1;
    this.density = data.density ?? 1;
    this.sector = data.sector ?? '';
  }

  readonly KLASS = 'Platelet';
  position: Vector3;
}
