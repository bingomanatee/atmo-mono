import { FIELD_TYPES, CollSync } from '@wonderlandlabs/multiverse';
import { SchemaLocal, Universe } from '@wonderlandlabs/multiverse';
import { Multiverse } from '@wonderlandlabs/multiverse/dist';
import {
  COLLECTIONS,
  SIM_PLANETS_SCHEMA,
  SIM_PLATES_SCHEMA,
  SIM_SIMULATIONS_SCHEMA,
  UNIVERSES,
} from './constants';

export function coord(prefix = '') {
  return {
    [`${prefix}x`]: FIELD_TYPES.number,
    [`${prefix}y`]: FIELD_TYPES.number,
    [`${prefix}z`]: FIELD_TYPES.number,
  };
}

export function simUniverse(mv: Multiverse) {
  const simUniv = new Universe(UNIVERSES.SIM, mv);

  const platesCollection = new CollSync({
    name: COLLECTIONS.PLATES,
    universe: simUniv,
    schema: new SchemaLocal(COLLECTIONS.PLATES, SIM_PLATES_SCHEMA),
  });

  const planetsCollection = new CollSync({
    name: COLLECTIONS.PLANETS,
    universe: simUniv,
    schema: new SchemaLocal(COLLECTIONS.PLANETS, SIM_PLANETS_SCHEMA),
  });

  const simulationsCollection = new CollSync({
    name: COLLECTIONS.SIMULATIONS,
    universe: simUniv,
    schema: new SchemaLocal(COLLECTIONS.SIMULATIONS, SIM_SIMULATIONS_SCHEMA),
  });

  return simUniv;
}
