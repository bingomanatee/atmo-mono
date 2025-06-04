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
        h3Cell: '8a1fb46622dffff',
        neighborCellIds: ['8a1fb46622dffff', '8a1fb46622e7fff'],
        position: { x: 0, y: 0, z: 0 },
        density: 2.7,
        thickness: 50,
        removed: false,
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
      const schema = new SchemaLocal('platelets', SIM_PLATELETS_SCHEMA);
      const invalidRecord = {
        id: 'plt1',
        plateId: 'p1',
        // planetId, h3Cell, neighborCellIds, position, density, thickness are missing
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

    it('should validate record with removed field set to true', () => {
      const schema = new SchemaLocal('platelets', SIM_PLATELETS_SCHEMA);
      const validRecord = {
        id: 'plt1',
        plateId: 'p1',
        planetId: 'planet1',
        h3Cell: '8a1fb46622dffff',
        neighborCellIds: ['8a1fb46622dffff', '8a1fb46622e7fff'],
        position: { x: 0, y: 0, z: 0 },
        density: 2.7,
        thickness: 50,
        removed: true,
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

    it('should validate record without removed field (optional with default)', () => {
      const schema = new SchemaLocal('platelets', SIM_PLATELETS_SCHEMA);
      const validRecord = {
        id: 'plt1',
        plateId: 'p1',
        planetId: 'planet1',
        h3Cell: '8a1fb46622dffff',
        neighborCellIds: ['8a1fb46622dffff', '8a1fb46622e7fff'],
        position: { x: 0, y: 0, z: 0 },
        density: 2.7,
        thickness: 50,
        // removed field is omitted - should default to false
      };
      let hasError = false;
      let errorDetails = '';
      for (const [fieldName, field] of Object.entries(schema.fields)) {
        // Skip validation for optional fields that are undefined
        if (validRecord[fieldName] === undefined && field.meta?.optional) {
          continue;
        }
        const error = validateField(
          validRecord[fieldName],
          fieldName,
          schema,
          validRecord,
        );
        if (error) {
          hasError = true;
          errorDetails = `Field ${fieldName}: ${error}`;
          break;
        }
      }
      if (hasError) {
        console.log('Validation error:', errorDetails);
      }
      expect(hasError).toBe(false);
    });
  });
});
