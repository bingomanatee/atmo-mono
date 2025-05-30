import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import {
  CollAsync,
  FIELD_TYPES,
  Multiverse,
  SchemaLocal,
  Universe,
} from '@wonderlandlabs/multiverse';
import type { Vector3Like } from 'three';
import { Vector3 } from 'three';
import { COLLECTIONS } from './PlateSimulation/constants';
import { IndexedSun } from './PlateSimulation/managers/sun/IndexedSun';
import { Plate } from './PlateSimulation/Plate';
import { Platelet } from './PlateSimulation/Platelet';
import {
  SIM_PLANETS_SCHEMA,
  SIM_PLATE_STEPS_SCHEMA,
  SIM_PLATELET_STEPS_SCHEMA,
  SIM_PLATELETS_SCHEMA,
  SIM_PLATES_SCHEMA,
  SIM_SIMULATIONS_SCHEMA,
  UNIVERSES,
} from './schema';

export function coord(prefix = '') {
  return {
    [`${prefix}x`]: FIELD_TYPES.number,
    [`${prefix}y`]: FIELD_TYPES.number,
    [`${prefix}z`]: FIELD_TYPES.number,
  };
}

export function asCoord(prefix: string, p: Vector3Like = new Vector3()) {
  return {
    [`${prefix}x`]: p.x,
    [`${prefix}y`]: p.y,
    [`${prefix}z`]: p.z,
  };
}

export function simUniverse(mv: Multiverse) {
  const simUniv = new Universe(UNIVERSES.SIM, mv);

  const platesCollection = new CollAsync({
    name: COLLECTIONS.PLATES,
    universe: simUniv,
    schema: new SchemaLocal(
      COLLECTIONS.PLATES,
      SIM_PLATES_SCHEMA,
      ({ inputRecord }) => {
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
    ),
  });

  const planetsCollection = new CollAsync({
    name: COLLECTIONS.PLANETS,
    universe: simUniv,
    schema: new SchemaLocal(COLLECTIONS.PLANETS, SIM_PLANETS_SCHEMA),
  });

  const simulationsCollection = new CollAsync({
    name: COLLECTIONS.SIMULATIONS,
    universe: simUniv,
    schema: new SchemaLocal(COLLECTIONS.SIMULATIONS, SIM_SIMULATIONS_SCHEMA),
  });

  const plateCollection = new CollAsync({
    name: COLLECTIONS.STEPS,
    universe: simUniv,
    schema: new SchemaLocal(COLLECTIONS.STEPS, SIM_PLATE_STEPS_SCHEMA),
  });

  const plateletStepsCollection = new IndexedSun({
    name: COLLECTIONS.PLATELET_STEPS,
    universe: simUniv,
    schema: new SchemaLocal(
      COLLECTIONS.PLATELET_STEPS,
      SIM_PLATELET_STEPS_SCHEMA,
    ),
  });

  const plateletsCollection = new CollAsync({
    name: COLLECTIONS.PLATELETS,
    universe: simUniv,
    schema: new SchemaLocal(
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
    ),
  });

  return simUniv;
}

export function varySpeedByRadius(
  earthSpeed: number,
  radiusKm: number,
): number {
  const scaleFactor = radiusKm / EARTH_RADIUS;
  const speed = earthSpeed * Math.pow(scaleFactor, 0.5);
  return Math.max(1, Math.min(speed, 20));
}
