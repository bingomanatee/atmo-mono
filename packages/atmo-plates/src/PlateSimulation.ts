import { Multiverse, SchemaUniversal } from '@wonderlandlabs/multiverse';
import { FIELD_TYPES, Universe } from '@wonderlandlabs/multiverse';

function coord(prefix = '') {
  return {
    [`${prefix}x`]: FIELD_TYPES.number,
    [`${prefix}y`]: FIELD_TYPES.number,
    [`${prefix}z`]: FIELD_TYPES.number,
  };
}

export interface Plate {
  x: number;
  y: number;
  z: number;
  radius: number;
  density: number;
  thickness: number;
}

const UNIVERSAL_SCHEMA = new Map([
  [
    'planets',
    new SchemaUniversal<Plate>('planets', {
      id: FIELD_TYPES.string,
      radius: FIELD_TYPES.number,
      name: { type: FIELD_TYPES.number, meta: { optional: true } },
    }),
  ],
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
    'plate_step',
    new SchemaUniversal<Plate>('plate_step', {
      id: FIELD_TYPES.string,
      plateId: FIELD_TYPES.string,
      x: FIELD_TYPES.number,
      y: FIELD_TYPES.number,
      z: FIELD_TYPES.number,
      step: FIELD_TYPES.number,
      ...coord('v'),
      ...coord('0'),
    }),
  ],
  [
    'sim',
    new SchemaUniversal<Plate>('sim', {
      id: FIELD_TYPES.string,
      name: FIELD_TYPES.string,
      planetId: FIELD_TYPES.string,
    }),
  ],
]);

function simUniverse(mv: Multiverse) {
  const simUniv = new Universe('simUniv');

  mv.add(simUniv);
  return simUniv;
}

export class PlateSimulation {
  #mv: Multiverse;

  constructor() {
    this.#mv = new Multiverse(UNIVERSAL_SCHEMA);
    this.#mv.add(simUniverse(this.#mv));
  }
}
