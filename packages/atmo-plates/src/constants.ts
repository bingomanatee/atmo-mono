import { FIELD_TYPES, SchemaUniversal } from '@wonderlandlabs/multiverse';
import type { Plate } from './PlateSimulation';
import type { PlateIF } from './types.atmo-plates';
import { coord } from './utils';

export const COLLECTIONS = {
  PLATES: 'plates',
  PLANETS: 'planets',
  SIMULATIONS: 'simulations',
};
export const UNIVERSES = {
  SIM: 'simUniv',
  API: 'apiUniv',
};

export interface PlanetLocal {
  name: string;
  radius: number;
}

export const UNIVERSAL_SCHEMA = new Map([
  [
    COLLECTIONS.PLANETS,
    new SchemaUniversal<Plate>(COLLECTIONS.PLANETS, {
      id: FIELD_TYPES.string,
      radius: FIELD_TYPES.number,
      name: { type: FIELD_TYPES.string, meta: { optional: true } },
    }),
  ],
  [
    COLLECTIONS.PLATES,
    new SchemaUniversal<Plate>(COLLECTIONS.PLATES, {
      id: FIELD_TYPES.string,
      x: FIELD_TYPES.number,
      y: FIELD_TYPES.number,
      z: FIELD_TYPES.number,
      radius: FIELD_TYPES.number,
      density: FIELD_TYPES.number,
      thickness: FIELD_TYPES.number,
      name: { type: FIELD_TYPES.string, meta: { optional: true } },
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
    COLLECTIONS.SIMULATIONS,
    new SchemaUniversal<Plate>(COLLECTIONS.SIMULATIONS, {
      id: FIELD_TYPES.string,
      name: FIELD_TYPES.string,
      planetId: FIELD_TYPES.string,
    }),
  ],
]);
/**
 * Schema for plates in the simulation universe
 * Includes PlateIF properties (radius, density, thickness) and additional fields
 */
export const SIM_PLATES_SCHEMA = {
  // Basic identification
  id: FIELD_TYPES.string,
  name: {
    type: FIELD_TYPES.string,
    meta: {
      optional: true,
    },
  },

  // PlateIF properties
  radius: FIELD_TYPES.number,
  density: FIELD_TYPES.number,
  thickness: FIELD_TYPES.number,

  // Position data
  position: { type: FIELD_TYPES.object, isLocal: true },
  'position.x': {
    exportOnly: true,
    type: FIELD_TYPES.number,
    universalName: 'x',
  },
  'position.y': {
    exportOnly: true,
    type: FIELD_TYPES.number,
    universalName: 'y',
  },
  'position.z': {
    exportOnly: true,
    type: FIELD_TYPES.number,
    universalName: 'z',
  },

  // Reference to parent planet
  planetId: FIELD_TYPES.string,
};
export const SIM_PLANETS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: {
    type: FIELD_TYPES.string,
    meta: {
      optional: true,
    },
  },
  radius: FIELD_TYPES.number,
};
export const SIM_SIMULATIONS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  planetId: FIELD_TYPES.string,
};
