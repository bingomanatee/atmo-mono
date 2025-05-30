// ─── Imports ─────────────────────────────────────────────────────
import {
  FIELD_TYPES,
  SchemaLocal,
  SchemaUniversal,
} from '@wonderlandlabs/multiverse';
import { Vector3 } from 'three';
import { COLLECTIONS } from './PlateSimulation/constants';
import { Platelet } from './PlateSimulation/Platelet';
import type { Plate } from './PlateSimulation/PlateSimulation';
import { coord } from './utils';

// ─── Constants: Collections & Universes ───────────────────────────
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
  id: { type: FIELD_TYPES.string, meta: { required: true } },
  name: { type: FIELD_TYPES.string, meta: { optional: true } },
  radius: { type: FIELD_TYPES.number, meta: { required: true } },
  density: { type: FIELD_TYPES.number, meta: { required: true } },
  thickness: { type: FIELD_TYPES.number, meta: { required: true } },
  position: {
    type: FIELD_TYPES.object,
    isLocal: true,
    meta: { required: true },
    univFields: {
      x: 'x',
      y: 'y',
      z: 'z',
    },
  },
  planetId: { type: FIELD_TYPES.string, meta: { required: true } },
};

export const SIM_PLATELETS_SCHEMA = new SchemaLocal<Platelet>('platelets', {
  id: { type: FIELD_TYPES.string, meta: { required: true } },
  plateId: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
  planetId: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
  position: {
    type: FIELD_TYPES.object,
    isLocal: true,
    meta: { required: true },
    univFields: {
      x: 'x',
      y: 'y',
      z: 'z',
    },
  },
  density: { type: FIELD_TYPES.number, meta: { required: true } },
  thickness: { type: FIELD_TYPES.number, meta: { required: true } },
});

export const SIM_SIMULATIONS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  planetId: FIELD_TYPES.string,
  plateCount: FIELD_TYPES.number,
  maxPlateRadius: {
    type: FIELD_TYPES.number,
    meta: { optional: true, default: Math.PI / 6 },
  },
};

export const SIM_PLATE_STEPS_SCHEMA = {
  id: FIELD_TYPES.string,
  plateId: FIELD_TYPES.string,
  plateletId: FIELD_TYPES.string,
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

export const SIM_PLATELET_STEPS_SCHEMA = {
  id: FIELD_TYPES.string,
  plateletId: FIELD_TYPES.string,
  step: FIELD_TYPES.number,
  position: {
    type: FIELD_TYPES.object,
    meta: {
      fields: {
        x: FIELD_TYPES.number,
        y: FIELD_TYPES.number,
        z: FIELD_TYPES.number,
      },
    },
  },
  thickness: FIELD_TYPES.number,
  float: FIELD_TYPES.number,
  sector: FIELD_TYPES.string,
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
  elevation: FIELD_TYPES.number,
  area: FIELD_TYPES.number,
  position: FIELD_TYPES.object,
  velocity: FIELD_TYPES.object,
  isActive: FIELD_TYPES.boolean,
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
  plateletIds: {
    type: FIELD_TYPES.array,
    meta: {
      itemType: FIELD_TYPES.string,
      optional: true,
    },
  },
};

export const UNIVERSAL_PLATELET_STEPS_SCHEMA = {
  id: FIELD_TYPES.string,
  plateId: FIELD_TYPES.string,
  plateletId: FIELD_TYPES.string,
  thickness: FIELD_TYPES.number,
  float: FIELD_TYPES.number,
  h3Index: FIELD_TYPES.string,
  sector: FIELD_TYPES.string,
  ...coord('position'),
};

export const UNIVERSAL_SIMULATIONS_SCHEMA = {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  planetId: FIELD_TYPES.string,
  plateCount: FIELD_TYPES.number,
  maxPlateRadius: FIELD_TYPES.number,
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
    UNIVERSES.SIM,
    new Map([
      [
        COLLECTIONS.PLATES,
        new SchemaUniversal<Plate>(COLLECTIONS.PLATES, UNIVERSAL_PLATES_SCHEMA),
      ],
      [
        COLLECTIONS.PLANETS,
        new SchemaUniversal<Plate>(
          COLLECTIONS.PLANETS,
          UNIVERSAL_PLANETS_SCHEMA,
        ),
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
      [
        COLLECTIONS.PLATELET_STEPS,
        new SchemaUniversal<Plate>(
          COLLECTIONS.PLATELET_STEPS,
          UNIVERSAL_PLATELET_STEPS_SCHEMA,
        ),
      ],
    ]),
  ],
]);
