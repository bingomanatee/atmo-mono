// ─── Imports ─────────────────────────────────────────────────────
import { FIELD_TYPES, SchemaLocal, SchemaUniversal } from '@wonderlandlabs/multiverse';
import { COLLECTIONS } from './PlateSimulation/constants';
import { coord } from './utilities';
import { Platelet } from './PlateSimulation/Platelet';
import { PlateIF } from './types.atmo-plates';
import { PlateletIF, PlateletStepIF, PlateSimulationIF, SimStepIF } from './PlateSimulation/types.PlateSimulation';
import { Plate } from './PlateSimulation/Plate';

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
  id: { type: FIELD_TYPES.string, meta: { index: true } },
  name: { type: FIELD_TYPES.string, meta: { optional: true, index: true } },
  radius: FIELD_TYPES.number,
};

export const SIM_PLATES_SCHEMA = {
  id: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
  name: { type: FIELD_TYPES.string, meta: { optional: true, index: true } },
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
  planetId: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
};

export const SIM_PLATELETS_SCHEMA = {
  id: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
  plateId: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
  planetId: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
  h3Cell: { type: FIELD_TYPES.string, meta: { required: true, index: true } },
  neighborCellIds: { type: FIELD_TYPES.array },
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
  removed: {
    type: FIELD_TYPES.boolean,
    meta: { optional: true, default: false },
  },
};

export const SIM_SIMULATIONS_SCHEMA = {
  id: { type: FIELD_TYPES.string, meta: { index: true } },
  name: { type: FIELD_TYPES.string, meta: { index: true } },
  planetId: { type: FIELD_TYPES.string, meta: { index: true } },
  plateCount: FIELD_TYPES.number,
  maxPlateRadius: {
    type: FIELD_TYPES.number,
    meta: { optional: true, default: Math.PI / 6 },
  },
};

export const SIM_PLATE_STEPS_SCHEMA = {
  id: { type: FIELD_TYPES.string, meta: { index: true } },
  plateId: { type: FIELD_TYPES.string, meta: { index: true } },
  plateletId: { type: FIELD_TYPES.string, meta: { index: true } },
  step: { type: FIELD_TYPES.number, meta: { index: true } },
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
  id: { type: FIELD_TYPES.string, meta: { index: true } },
  plateletId: { type: FIELD_TYPES.string, meta: { index: true } },
  step: { type: FIELD_TYPES.number, meta: { index: true } },
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
  removed: FIELD_TYPES.boolean,
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
        new SchemaUniversal<PlateIF>(COLLECTIONS.PLATES, UNIVERSAL_PLATES_SCHEMA),
      ],
      [
        COLLECTIONS.PLANETS,
        new SchemaUniversal<PlateIF>(
          COLLECTIONS.PLANETS,
          UNIVERSAL_PLANETS_SCHEMA,
        ),
      ],
      [
        COLLECTIONS.PLATELETS,
        new SchemaUniversal<PlateletIF>(
          COLLECTIONS.PLATELETS,
          UNIVERSAL_PLATELETS_SCHEMA,
        ),
      ],
      [
        COLLECTIONS.SIMULATIONS,
        new SchemaUniversal<PlateSimulationIF>(
          COLLECTIONS.SIMULATIONS,
          UNIVERSAL_SIMULATIONS_SCHEMA,
        ),
      ],
      [
        COLLECTIONS.STEPS,
        new SchemaUniversal<SimStepIF>('plate_step', UNIVERSAL_PLATE_STEPS_SCHEMA),
      ],
      [
        COLLECTIONS.PLATELET_STEPS,
        new SchemaUniversal<PlateletStepIF>( // @TODO: these interfaces don't actually alignn with universal interfaces.
          COLLECTIONS.PLATELET_STEPS,
          UNIVERSAL_PLATELET_STEPS_SCHEMA,
        ),
      ],
    ]),
  ],
]);


// Create schemas
export const platesSchema = new SchemaLocal<PlateIF>(
  COLLECTIONS.PLATES,
  SIM_PLATES_SCHEMA,
  ({ inputRecord }): PlateIF => {
    // Convert plain objects to Plate instances
    if (
      inputRecord &&
      typeof inputRecord === 'object' &&
      !(inputRecord instanceof Plate)
    ) {
      return Plate.fromJSON(inputRecord as any);
    }
    return inputRecord;
  },
);

export const planetsSchema = new SchemaLocal(
  COLLECTIONS.PLANETS,
  SIM_PLANETS_SCHEMA,
);
export const simulationsSchema = new SchemaLocal(
  COLLECTIONS.SIMULATIONS,
  SIM_SIMULATIONS_SCHEMA,
);
export const plateStepsSchema = new SchemaLocal(
  COLLECTIONS.STEPS,
  SIM_PLATE_STEPS_SCHEMA,
);
export const plateletStepsSchema = new SchemaLocal(
  COLLECTIONS.PLATELET_STEPS,
  SIM_PLATELET_STEPS_SCHEMA,
);
export const plateletsSchema = new SchemaLocal(
  COLLECTIONS.PLATELETS,
  SIM_PLATELETS_SCHEMA,
  ({ inputRecord }) => {
    // Convert plain objects to Platelet instances
    if (
      inputRecord &&
      typeof inputRecord === 'object' &&
      !(inputRecord instanceof Platelet)
    ) {
      return new Platelet(inputRecord as any);
    }
    return inputRecord;
  },
);

export const schemaIndex = {
  [COLLECTIONS.PLATES]: platesSchema,
  [COLLECTIONS.PLANETS]: planetsSchema,
  [COLLECTIONS.SIMULATIONS]: simulationsSchema,
  [COLLECTIONS.STEPS]: plateStepsSchema,
  [COLLECTIONS.PLATELET_STEPS]: plateletStepsSchema,
  [COLLECTIONS.PLATELETS]: plateletsSchema,
}
