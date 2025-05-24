import { describe, it, expect } from 'vitest';
import { FIELD_TYPES, SchemaLocal } from '@wonderlandlabs/multiverse';
import { SIM_PLATES_SCHEMA, SIM_PLATELETS_SCHEMA } from './schema';

describe('Plate Schemas', () => {
  describe('SIM_PLATES_SCHEMA', () => {
    it('should validate a complete plate record', () => {
      const schema = new SchemaLocal('test', SIM_PLATES_SCHEMA);
      const validRecord = {
        id: 'plate1',
        name: 'Test Plate',
        radius: 100,
        density: 1.0,
        thickness: 10,
        position: { x: 0, y: 0, z: 0 },
        planetId: 'planet1',
        plateletIds: ['p1', 'p2'],
      };

      expect(() => schema.validate(validRecord)).not.toThrow();
    });

    it('should reject a plate record missing required fields', () => {
      const schema = new SchemaLocal('test', SIM_PLATES_SCHEMA);
      const invalidRecord = {
        id: 'plate1',
        name: 'Test Plate',
        // missing radius
        density: 1.0,
        thickness: 10,
        position: { x: 0, y: 0, z: 0 },
        planetId: 'planet1',
      };

      expect(() => schema.validate(invalidRecord)).toThrow();
    });

    it.skip('should reject a plate record with invalid position object', () => {
      const schema = new SchemaLocal('test', SIM_PLATES_SCHEMA);
      const invalidRecord = {
        id: 'plate1',
        name: 'Test Plate',
        radius: 100,
        density: 1.0,
        thickness: 10,
        position: { x: 0, y: 0 }, // missing z
        planetId: 'planet1',
      };

      expect(() => schema.validate(invalidRecord)).toThrow();
    });
  });

  describe('SIM_PLATELETS_SCHEMA', () => {
    it('should validate a complete platelet record', () => {
      const schema = new SchemaLocal('test', SIM_PLATELETS_SCHEMA);
      const validRecord = {
        id: 'p1',
        plateId: 'plate1',
        position: { x: 0, y: 0, z: 0 },
        radius: 10,
        thickness: 5,
        density: 1.0,
        planetId: 'planet1',
        sector: 'A1',
        plateletIds: ['p2', 'p3'],
      };

      expect(() => schema.validate(validRecord)).not.toThrow();
    });

    it('should reject a platelet record missing required fields', () => {
      const schema = new SchemaLocal('test', SIM_PLATELETS_SCHEMA);
      const invalidRecord = {
        id: 'p1',
        plateId: 'plate1',
        position: { x: 0, y: 0, z: 0 },
        // missing radius
        thickness: 5,
        density: 1.0,
        planetId: 'planet1',
        sector: 'A1',
      };

      expect(() => schema.validate(invalidRecord)).toThrow();
    });

    it('should reject a platelet record with invalid position object', () => {
      const schema = new SchemaLocal('test', SIM_PLATELETS_SCHEMA);
      const invalidRecord = {
        id: 'p1',
        plateId: 'plate1',
        position: { x: 0, y: 0 }, // missing z
        radius: 10,
        thickness: 5,
        density: 1.0,
        planetId: 'planet1',
        sector: 'A1',
      };

      expect(() => schema.validate(invalidRecord)).toThrow();
    });
  });
});
