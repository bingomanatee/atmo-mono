import { FIELD_TYPES, SchemaLocal } from '@atmo/multiverse';
import type { PostParams } from '@atmo/multiverse';
import { Platelet } from './types/Platelet';

// This schema is no longer needed as its fields are either:
// 1. Already in SIM_PLATELETS_SCHEMA (id, position, radius)
// 2. Should not be in platelet schema (velocity, mass, color, lastCollision)
// 3. Should be in step schema (sector)

export const SIM_PLATELET_COLLISION_SCHEMA = new SchemaLocal<Platelet>(
  'sim_platelets',
  {
    id: { type: FIELD_TYPES.string },
    position: {
      type: FIELD_TYPES.object,
      meta: {
        required: true,
        fields: {
          x: { type: FIELD_TYPES.number, meta: { required: true } },
          y: { type: FIELD_TYPES.number, meta: { required: true } },
          z: { type: FIELD_TYPES.number, meta: { required: true } },
        },
      },
    },
    velocity: {
      type: FIELD_TYPES.object,
      meta: {
        required: true,
        fields: {
          x: { type: FIELD_TYPES.number, meta: { required: true } },
          y: { type: FIELD_TYPES.number, meta: { required: true } },
          z: { type: FIELD_TYPES.number, meta: { required: true } },
        },
      },
    },
    radius: { type: FIELD_TYPES.number, meta: { required: true } },
    mass: { type: FIELD_TYPES.number, meta: { required: true } },
    color: { type: FIELD_TYPES.string, meta: { required: true } },
  },
);
