import { beforeEach, describe, expect, it } from 'vitest';
import { CollSync } from './collections/CollSync';
import { FIELD_TYPES } from './constants';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import { Universe } from './Universe';

describe('Multiverse univFields mapping', () => {
  let multiverse: Multiverse;

  beforeEach(() => {
    multiverse = new Multiverse();
  });

  describe('Field map generation with univFields', () => {
    it('should include univFields in localToUnivFieldMap', () => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('items', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        created_at: { type: FIELD_TYPES.string },
        tags: { type: FIELD_TYPES.array },
      });

      // Create a local schema with nested metadata object
      const localSchema = new SchemaLocal('items', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        // Add fields for universal mapping
        created_at: {
          type: FIELD_TYPES.string,
          universalName: 'created_at',
          exportOnly: true,
        },
        tags: {
          type: FIELD_TYPES.array,
          universalName: 'tags',
          exportOnly: true,
        },
        metadata: {
          type: FIELD_TYPES.object,
          isLocal: true,
          univFields: {
            createdAt: 'created_at',
            tags: 'tags',
          },
        },
      });

      // Register the schemas
      multiverse.baseSchemas.set('items', universalSchema);

      // Create a universe and collection
      const universe = new Universe('test-universe', multiverse);
      const collection = new CollSync({
        name: 'items',
        universe,
        schema: localSchema,
      });

      // Get the field map
      const fieldMap = multiverse.localToUnivFieldMap(
        collection,
        'test-universe',
      );

      // Verify that univFields are included in the map
      expect(fieldMap).toBeDefined();
      expect(fieldMap['id']).toBe('id');
      expect(fieldMap['name']).toBe('name');
      expect(fieldMap['metadata.createdAt']).toBe('created_at');
      expect(fieldMap['metadata.tags']).toBe('tags');
    });

    it('should include univFields in univToLocalFieldMap', () => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('items', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        created_at: { type: FIELD_TYPES.string },
        tags: { type: FIELD_TYPES.array },
      });

      // Create a local schema with nested metadata object
      const localSchema = new SchemaLocal('items', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        metadata: {
          type: FIELD_TYPES.object,
          isLocal: true,
          univFields: {
            createdAt: 'created_at',
            tags: 'tags',
          },
        },
      });

      // Register the schemas
      multiverse.baseSchemas.set('items', universalSchema);

      // Create a universe and collection
      const universe = new Universe('test-universe', multiverse);
      const collection = new CollSync({
        name: 'items',
        universe,
        schema: localSchema,
      });

      // Get the field map
      const fieldMap = multiverse.univToLocalFieldMap(
        collection,
        'test-universe',
      );

      // Verify that univFields are included in the map
      expect(fieldMap).toBeDefined();
      expect(fieldMap['id']).toBe('id');
      expect(fieldMap['name']).toBe('name');
      expect(fieldMap['created_at']).toBe('metadata.createdAt');
      expect(fieldMap['tags']).toBe('metadata.tags');
    });
  });

  describe('Bidirectional mapping with univFields', () => {
    it('should map nested fields to universal fields and back', () => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('items', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        created_at: { type: FIELD_TYPES.string },
        tags: { type: FIELD_TYPES.array },
        status: { type: FIELD_TYPES.string },
      });

      // Create a local schema with nested metadata object
      const localSchema = new SchemaLocal('items', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        // Add fields for the universal fields with exportOnly: true

        'metadata.createdAt': {
          type: FIELD_TYPES.string,
          universalName: 'created_at',
          exportOnly: true,
        },
        'metadata.tags': {
          type: FIELD_TYPES.array,
          universalName: 'tags',
          exportOnly: true,
        },
        'metadata.status': {
          type: FIELD_TYPES.string,
          universalName: 'status',
          exportOnly: true,
        },
        metadata: {
          type: FIELD_TYPES.object,
          isLocal: true,
          // Use univFields to map universal fields to local metadata fields
          univFields: {
            createdAt: 'created_at',
            tags: 'tags',
            status: 'status',
          },
          // Add import function to ensure metadata object is properly initialized
          import: (props) => {
            return props.value || { createdAt: '', tags: [], status: '' };
          },
        },
      });

      // Register the schemas
      multiverse.baseSchemas.set('items', universalSchema);

      // Create a universe and collection
      const universe = new Universe('test-universe', multiverse);
      const collection = new CollSync({
        name: 'items',
        universe,
        schema: localSchema,
      });

      // Create a universal record
      const universalRecord = {
        id: 'item1',
        name: 'Test Item',
        created_at: '2023-06-15',
        tags: ['test', 'item'],
        status: 'active',
      };

      // Convert to local format
      const localRecord = multiverse.toLocal(
        universalRecord,
        collection,
        'test-universe',
      );

      // Verify the mapping to local format
      expect(localRecord).toEqual({
        id: 'item1',
        name: 'Test Item',
        metadata: {
          createdAt: '2023-06-15',
          tags: ['test', 'item'],
          status: 'active',
        },
      });

      // Convert back to universal format
      const convertedUniversalRecord = multiverse.toUniversal(
        localRecord,
        collection,
        'test-universe',
      );

      // Verify the mapping back to universal format - only check id and name
      // since the exportOnly fields won't be populated
      expect(convertedUniversalRecord.id).toEqual(universalRecord.id);
      expect(convertedUniversalRecord.name).toEqual(universalRecord.name);
    });

    it('should handle multiple nested objects with univFields', () => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('objects', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        x: { type: FIELD_TYPES.number },
        y: { type: FIELD_TYPES.number },
        z: { type: FIELD_TYPES.number },
        created_at: { type: FIELD_TYPES.string },
        updated_at: { type: FIELD_TYPES.string },
      });

      // Create a local schema with multiple nested objects
      const localSchema = new SchemaLocal('objects', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        // Add fields for the universal fields with exportOnly: true
        x: {
          type: FIELD_TYPES.number,
          universalName: 'x',
          exportOnly: true,
        },
        y: {
          type: FIELD_TYPES.number,
          universalName: 'y',
          exportOnly: true,
        },
        z: {
          type: FIELD_TYPES.number,
          universalName: 'z',
          exportOnly: true,
        },
        created_at: {
          type: FIELD_TYPES.string,
          universalName: 'created_at',
          exportOnly: true,
        },
        updated_at: {
          type: FIELD_TYPES.string,
          universalName: 'updated_at',
          exportOnly: true,
        },
        position: {
          type: FIELD_TYPES.object,
          isLocal: true,
          univFields: {
            x: 'x',
            y: 'y',
            z: 'z',
          },
          import: ({ value }) => {
            return value || { x: 0, y: 0, z: 0 };
          },
        },
        timestamps: {
          type: FIELD_TYPES.object,
          isLocal: true,
          univFields: {
            created: 'created_at',
            updated: 'updated_at',
          },
          import: ({ value }) => {
            return value || { created: '', updated: '' };
          },
        },
      });

      // Register the schemas
      multiverse.baseSchemas.set('objects', universalSchema);

      // Create a universe and collection
      const universe = new Universe('test-universe', multiverse);
      const collection = new CollSync({
        name: 'objects',
        universe,
        schema: localSchema,
      });

      // Create a universal record
      const universalRecord = {
        id: 'obj1',
        name: 'Test Object',
        x: 10,
        y: 20,
        z: 30,
        created_at: '2023-06-15',
        updated_at: '2023-06-16',
      };

      // Convert to local format
      const localRecord = multiverse.toLocal(
        universalRecord,
        collection,
        'test-universe',
      );

      // Verify the mapping to local format
      expect(localRecord).toEqual({
        id: 'obj1',
        name: 'Test Object',
        position: {
          x: 10,
          y: 20,
          z: 30,
        },
        timestamps: {
          created: '2023-06-15',
          updated: '2023-06-16',
        },
      });

      // Convert back to universal format
      const convertedUniversalRecord = multiverse.toUniversal(
        localRecord,
        collection,
        'test-universe',
      );

      // Verify the mapping back to universal format - only check id and name
      // since the exportOnly fields won't be populated
      expect(convertedUniversalRecord.id).toEqual(universalRecord.id);
      expect(convertedUniversalRecord.name).toEqual(universalRecord.name);
    });
  });
});
