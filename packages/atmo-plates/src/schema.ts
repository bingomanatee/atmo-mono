// ─── Imports ─────────────────────────────────────────────────────
import { FIELD_TYPES, SchemaUniversal } from '@wonderlandlabs/multiverse';
import type { Plate } from './PlateSimulation/PlateSimulation';
import type { PlateIF } from './types.atmo-plates';
import { coord } from './utils';

// ─── Constants: Collections & Universes ───────────────────────────
export const COLLECTIONS = {
  PLATES: 'plates',
  PLANETS: 'planets',
  SIMULATIONS: 'simulations',
  STEPS: 'plate_steps',
  PLATELETS: 'platelets',
};

export const UNIVERSES = {
  SIM: 'simUniv',
  API: 'apiUniv',
};

// ─── Types ───────────────────────────────────────────────────────
export interface PlanetLocal {
  name: string;
  radius: number;
}

// ─── ✅ Simulation-Specific Schemas (Nested) ─────────────────────
export const SIM_PLANETS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: { type: FIELD_TYPES.string, meta: { optional: true } },
  radius: FIELD_TYPES.number,
};

export const SIM_PLATES_SCHEMA = {
  id: FIELD_TYPES.string,
  name: { type: FIELD_TYPES.string, meta: { optional: true } },
  radius: FIELD_TYPES.number,
  density: FIELD_TYPES.number,
  thickness: FIELD_TYPES.number,
  position: { type: FIELD_TYPES.object, isLocal: true },
  planetId: FIELD_TYPES.string,
};

export const SIM_PLATELETS_SCHEMA = {
  id: FIELD_TYPES.string,
  plateId: FIELD_TYPES.string,
  position: { type: FIELD_TYPES.object, isLocal: true },
  radius: FIELD_TYPES.number,
  thickness: FIELD_TYPES.number,
  density: FIELD_TYPES.number,
};

export const SIM_SIMULATIONS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  planetId: FIELD_TYPES.string,
  plateCount: FIELD_TYPES.number,
};

export const SIM_PLATE_STEPS_SCHEMA = {
  id: FIELD_TYPES.string,
  plateId: FIELD_TYPES.string,
  step: FIELD_TYPES.number,
  velocity: {
    type: FIELD_TYPES.object,
    isLocal: true,
    univFields: {
      x: 'vx',
      y: 'vy',
      z: 'vz',
    },
  },
  start: {
    type: FIELD_TYPES.object,
    isLocal: true,
    univFields: {
      x: 'sx',
      y: 'sy',
      z: 'sz',
    },
  },
  position: {
    type: FIELD_TYPES.object,
    isLocal: true,
    univFields: {
      x: 'x',
      y: 'y',
      z: 'z',
    },
  },
};

// ─── 🌐 Universal Schemas (Flat, Translation Format) ─────────────
export const UNIVERSAL_PLANETS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  radius: FIELD_TYPES.number,
};

export const UNIVERSAL_PLATES_SCHEMA = {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  radius: FIELD_TYPES.number,
  density: FIELD_TYPES.number,
  thickness: FIELD_TYPES.number,
  planetId: FIELD_TYPES.string,
};

export const UNIVERSAL_PLATELETS_SCHEMA = {
  id: FIELD_TYPES.string,
  plateId: FIELD_TYPES.string,
  x: FIELD_TYPES.number,
  y: FIELD_TYPES.number,
  z: FIELD_TYPES.number,
  radius: FIELD_TYPES.number,
  thickness: FIELD_TYPES.number,
  density: FIELD_TYPES.number,
  neighborCellIds: {
    type: FIELD_TYPES.array,
    meta: { itemType: FIELD_TYPES.string },
  },
};

export const UNIVERSAL_SIMULATIONS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  planetId: FIELD_TYPES.string,
  plateCount: FIELD_TYPES.number,
};

export const UNIVERSAL_PLATE_STEPS_SCHEMA = {
  id: FIELD_TYPES.string,
  plateId: FIELD_TYPES.string,
  step: FIELD_TYPES.number,
  x: FIELD_TYPES.number,
  y: FIELD_TYPES.number,
  z: FIELD_TYPES.number,
  ...coord('v'),
  ...coord('s'),
};

// ─── Universal Schema Map ───────────────────────────────────────
export const UNIVERSAL_SCHEMA = new Map([
  [
    COLLECTIONS.PLANETS,
    new SchemaUniversal<Plate>(COLLECTIONS.PLANETS, UNIVERSAL_PLANETS_SCHEMA),
  ],
  [
    COLLECTIONS.PLATES,
    new SchemaUniversal<Plate>(COLLECTIONS.PLATES, UNIVERSAL_PLATES_SCHEMA),
  ],
  [
    COLLECTIONS.PLATELETS,
    new SchemaUniversal<Plate>(
      COLLECTIONS.PLATELETS,
      UNIVERSAL_PLATELETS_SCHEMA,
    ),
  ],
  [
    COLLECTIONS.SIMULATIONS,
    new SchemaUniversal<Plate>(
      COLLECTIONS.SIMULATIONS,
      UNIVERSAL_SIMULATIONS_SCHEMA,
    ),
  ],
  [
    COLLECTIONS.STEPS,
    new SchemaUniversal<Plate>('plate_step', UNIVERSAL_PLATE_STEPS_SCHEMA),
  ],
]);
