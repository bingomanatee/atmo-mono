import { SchemaLocal, validateField } from '@wonderlandlabs/multiverse';
import { describe, expect, it } from 'vitest';
import { SIM_PLATELETS_SCHEMA, SIM_PLATES_SCHEMA } from './schema';

describe('Schema Validation', () => {
  describe('SIM_PLATES_SCHEMA', () => {
    it('should validate a complete record', () => {
      const schema = new SchemaLocal('plates', SIM_PLATES_SCHEMA);
      const validRecord = {
        id: 'p1',
        name: 'Test Plate',
        radius: 1000,
        density: 2.7,
        thickness: 50,
        position: { x: 0, y: 0, z: 0 },
        planetId: 'planet1',
        plateletIds: [],
      };
      let hasError = false;
      for (const [fieldName, field] of Object.entries(schema.fields)) {
        const error = validateField(
          validRecord[fieldName],
          fieldName,
          schema,
          validRecord,
        );
        if (error) {
          hasError = true;
          break;
        }
      }
      expect(hasError).toBe(false);
    });

    it('should reject an incomplete record', () => {
      const schema = new SchemaLocal('plates', SIM_PLATES_SCHEMA);
      const invalidRecord = {
        id: 'p1',
        name: 'Test Plate',
        // Missing required fields
      };
      let hasError = false;
      for (const [fieldName, field] of Object.entries(schema.fields)) {
        const error = validateField(
          invalidRecord[fieldName],
          fieldName,
          schema,
          invalidRecord,
        );
        if (error) {
          hasError = true;
          break;
        }
      }
      expect(hasError).toBe(true);
    });
  });

  describe('SIM_PLATELETS_SCHEMA', () => {
    it('should validate a complete record', () => {
      const schema = new SchemaLocal('platelets', SIM_PLATELETS_SCHEMA);
      const validRecord = {
        id: 'plt1',
        plateId: 'p1',
        planetId: 'planet1',
        position: { x: 0, y: 0, z: 0 },
        density: 2.7,
        thickness: 50,
      };
      let hasError = false;
      for (const [fieldName, field] of Object.entries(schema.fields)) {
        const error = validateField(
          validRecord[fieldName],
          fieldName,
          schema,
          validRecord,
        );
        if (error) {
          hasError = true;
          break;
        }
      }
      expect(hasError).toBe(false);
    });

    it('should reject an incomplete record', () => {
      const schema = SIM_PLATELETS_SCHEMA;
      const invalidRecord = {
        id: 'plt1',
        plateId: 'p1',
        // planetId, position, density, thickness are missing
      };
      let hasError = false;
      for (const [fieldName, field] of Object.entries(schema.fields)) {
        const error = validateField(
          invalidRecord[fieldName],
          fieldName,
          schema,
          invalidRecord,
        );
        if (error) {
          hasError = true;
          break;
        }
      }
      expect(hasError).toBe(true);
    });
  });
});
