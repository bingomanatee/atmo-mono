import { describe, it, expect, beforeEach } from 'vitest';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import { FIELD_TYPES } from './constants';
import { CollSync } from './collections/CollSync';
import { Universe } from './Universe';

describe('Multiverse.toLocal', () => {
  let multiverse: Multiverse;

  beforeEach(() => {
    multiverse = new Multiverse();
  });

  describe('Basic field mapping', () => {
    it('should map universal fields to local fields', () => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('items', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        created_at: { type: FIELD_TYPES.string },
      });

      // Create a local schema
      const localSchema = new SchemaLocal('items', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        title: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        createdAt: {
          type: FIELD_TYPES.string,
          universalName: 'created_at',
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
      };

      // Convert to local format
      const localRecord = multiverse.toLocal(
        universalRecord,
        collection,
        'test-universe',
      );

      // Verify the mapping
      expect(localRecord).toEqual({
        id: 'item1',
        title: 'Test Item',
        createdAt: '2023-06-15',
      });
    });
  });

  describe('Nested object mapping', () => {
    it('should create nested objects using import function', () => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('objects', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        x: { type: FIELD_TYPES.number },
        y: { type: FIELD_TYPES.number },
        z: { type: FIELD_TYPES.number },
      });

      // Create a local schema with nested position object
      const localSchema = new SchemaLocal('objects', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        position: {
          type: FIELD_TYPES.object,
          isLocal: true,
          import: ({ currentRecord }) => {
            return {
              x: currentRecord?.x ?? 0,
              y: currentRecord?.y ?? 0,
              z: currentRecord?.z ?? 0,
            };
          },
        },
        // Add fields for x, y, z to match the universal schema
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
      };

      // Convert to local format
      const localRecord = multiverse.toLocal(
        universalRecord,
        collection,
        'test-universe',
      );

      // Verify the nested object was created
      expect(localRecord).toEqual({
        id: 'obj1',
        name: 'Test Object',
        position: {
          x: 10,
          y: 20,
          z: 30,
        },
      });
    });

    it('should create nested objects using univFields', () => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('objects', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        metadata_created_at: { type: FIELD_TYPES.string },
        metadata_tags: { type: FIELD_TYPES.array },
        metadata_status: { type: FIELD_TYPES.string },
      });

      // Create a local schema with nested metadata object
      const localSchema = new SchemaLocal('objects', {
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
            createdAt: 'metadata_created_at',
            tags: 'metadata_tags',
            status: 'metadata_status',
          },
        },
        // Add fields to match the universal schema
        metadata_created_at: {
          type: FIELD_TYPES.string,
          universalName: 'metadata_created_at',
          exportOnly: true,
        },
        metadata_tags: {
          type: FIELD_TYPES.array,
          universalName: 'metadata_tags',
          exportOnly: true,
        },
        metadata_status: {
          type: FIELD_TYPES.string,
          universalName: 'metadata_status',
          exportOnly: true,
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
        metadata_created_at: '2023-06-15',
        metadata_tags: ['test', 'object'],
        metadata_status: 'active',
      };

      // Convert to local format
      const localRecord = multiverse.toLocal(
        universalRecord,
        collection,
        'test-universe',
      );

      // Verify the nested object was created with mapped fields
      expect(localRecord).toEqual({
        id: 'obj1',
        name: 'Test Object',
        metadata: {
          createdAt: '2023-06-15',
          tags: ['test', 'object'],
          status: 'active',
        },
      });
    });
  });
});
