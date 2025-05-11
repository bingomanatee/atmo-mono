import { Multiverse, SchemaUniversal } from '@wonderlandlabs/multiverse';
import { FIELD_TYPES } from '@wonderlandlabs/multiverse/dist';

interface Plate {
  x: number;
  y: number;
  z: number;
  radius: number;
  density: number;
  thickness: number;
}
const UNIVERSAL_SCHEMA = new Map([
  [
    'plates',
    new SchemaUniversal<Plate>('plates', {
      id: FIELD_TYPES.string,
      x: FIELD_TYPES.number,
      y: FIELD_TYPES.number,
      z: FIELD_TYPES.number,
      radius: FIELD_TYPES.number,
      density: FIELD_TYPES.number,
      thickness: FIELD_TYPES.number,
      name: { type: FIELD_TYPES.number, meta: { optional: true } },
    }),
  ],
  [
    'sim',
    new SchemaUniversal<Plate>('plates', {
      id: FIELD_TYPES.string,
      name: FIELD_TYPES.string,
    }),
  ],
]);

export class PlateSimulation {
  #mv: Multiverse;

  constructor() {
    this.#mv = new Multiverse(UNIVERSAL_SCHEMA);
  }
}
