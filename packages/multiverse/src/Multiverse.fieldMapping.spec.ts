import { beforeEach, describe, expect, it } from 'vitest';
import { CollSync } from './collections/CollSync';
import { FIELD_TYPES } from './constants';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import { Universe } from './Universe';

// Define types for our tests
type SimpleRecord = {
  id: string;
  name: string;
  metadata?: {
    createdAt?: string;
    tags?: string[];
  };
};

type ComplexRecord = {
  id: string;
  name: string;
  metadata: {
    createdAt: string;
    tags: string[];
    status: string;
  };
};

describe('Multiverse field mapping', () => {
  describe('univFields property', () => {
    let multiverse: Multiverse;
    let simpleUniverse: Universe;
    let complexUniverse: Universe;
    let simpleCollection: CollSync<SimpleRecord, string>;
    let complexCollection: CollSync<ComplexRecord, string>;

    beforeEach(() => {
      // Create a universal schema
      const universalSchema = new SchemaUniversal('items', {
        id: FIELD_TYPES.string,
        name: FIELD_TYPES.string,
        created_at: FIELD_TYPES.string,
        tags: FIELD_TYPES.array,
        status: FIELD_TYPES.string,
      });

      // Create a multiverse with the universal schema
      multiverse = new Multiverse(new Map([['items', universalSchema]]));

      // Create universes
      simpleUniverse = new Universe('simple-universe', multiverse);
      complexUniverse = new Universe('complex-universe', multiverse);

      // Create a schema for the simple universe
      const simpleSchema = new SchemaLocal<SimpleRecord>('items', {
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
        status: {
          type: FIELD_TYPES.string,
          universalName: 'status',
        },
      });

      // Create a schema for the complex universe
      const complexSchema = new SchemaLocal<ComplexRecord>('items', {
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
          // Use univFields to map universal fields to local metadata fields
          univFields: {
            createdAt: 'created_at',
            tags: 'tags',
            status: 'status',
          },
        },
      });

      // Create collections
      simpleCollection = new CollSync<SimpleRecord, string>({
        name: 'items',
        universe: simpleUniverse,
        schema: simpleSchema,
      });

      simpleCollection.debug = true;
      complexCollection = new CollSync<ComplexRecord, string>({
        name: 'items',
        universe: complexUniverse,
        schema: complexSchema,
      });

      // Add collections to universes
      simpleUniverse.add(simpleCollection);
      complexUniverse.add(complexCollection);
    });

    it('should map universal fields to local fields using univFields', () => {
      // Create a universal record
      const universalRecord = {
        id: 'item1',
        name: 'Test Item',
        created_at: '2023-06-15',
        tags: ['test', 'item'],
        status: 'pending',
      };
      // Set the record in the simple collection
      simpleCollection.set(universalRecord.id, {
        id: universalRecord.id,
        name: universalRecord.name,
        created_at: universalRecord.created_at,
        tags: universalRecord.tags,
        status: universalRecord.status,
      });

      // Transport the record to the complex universe
      multiverse.transport(universalRecord.id, {
        collectionName: 'items',
        fromU: 'simple-universe',
        toU: 'complex-universe',
      });

      // Get the record from the complex collection
      const complexRecord = complexCollection.get(universalRecord.id);

      // Verify the record was transported and the metadata object was created with mapped fields
      expect(complexRecord).toBeDefined();
      expect(complexRecord?.id).toBe(universalRecord.id);
      expect(complexRecord?.name).toBe(universalRecord.name);
      expect(complexRecord?.metadata).toBeDefined();
      expect(complexRecord?.metadata.createdAt).toBe(
        universalRecord.created_at,
      );
      expect(complexRecord?.metadata.tags).toEqual(universalRecord.tags);
      expect(complexRecord?.metadata.status).toBe(universalRecord.status);
    });

    it('should handle empty univFields object', () => {
      // Create a schema with empty univFields
      const emptySchema = new SchemaLocal<SimpleRecord>('items', {
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
          univFields: {}, // Empty univFields
          // Add import function to ensure metadata object is properly initialized
          import: () => {
            return {};
          },
        },
      });

      // Create a universe and collection
      const emptyUniverse = new Universe('empty-universe', multiverse);
      const emptyCollection = new CollSync<SimpleRecord, string>({
        name: 'items',
        universe: emptyUniverse,
        schema: emptySchema,
      });
      emptyUniverse.add(emptyCollection);

      // Create a record
      const record = {
        id: 'item2',
        name: 'Empty Test',
        metadata: {},
      };

      // Set the record
      emptyCollection.set(record.id, record);

      // Get the record
      const retrievedRecord = emptyCollection.get(record.id);

      // Verify the metadata object was created but is empty
      expect(retrievedRecord).toBeDefined();
      expect(retrievedRecord?.metadata).toBeDefined();
      expect(retrievedRecord?.metadata).toEqual({});
    });

    it('should use import function for special conditions', () => {
      console.log('---- start ', expect.getState().currentTestName);
      // Create a schema with import function for special conditions
      const specialSchema = new SchemaLocal<ComplexRecord>('items', {
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
            status: 'status',
            tags: 'tags',
          },
          // Use import for special conditions - calculating a derived value
          import: ({ newValue: metadata, inputRecord, currentRecord }) => {
            // Create a new metadata object with the mapped values
            const result = {
              createdAt: inputRecord?.created_at || '',
              status: '',
              tags: inputRecord?.tags || [],
            };

            // Add a derived status based on the tags from inputRecord
            if (inputRecord?.tags && Array.isArray(inputRecord.tags)) {
              if (inputRecord.tags.includes('important')) {
                result.status = 'high-priority';
              } else if (inputRecord.tags.includes('archived')) {
                result.status = 'inactive';
              } else {
                result.status = 'normal';
              }
            } else {
              result.status = 'unknown';
            }

            return result;
          },
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
      });

      // Create a universe and collection
      const specialUniverse = new Universe('special-universe', multiverse);
      const specialCollection = new CollSync<ComplexRecord, string>({
        name: 'items',
        universe: specialUniverse,
        schema: specialSchema,
      });
      specialCollection.debug = true;
      specialUniverse.add(specialCollection);

      // Create records with different tags
      const importantRecord = {
        id: 'important1',
        name: 'Important Item',
        created_at: '2023-06-15',
        tags: ['test', 'important'],
      };

      const archivedRecord = {
        id: 'archived1',
        name: 'Archived Item',
        created_at: '2023-05-10',
        tags: ['archived', 'old'],
      };

      const normalRecord = {
        id: 'normal1',
        name: 'Normal Item',
        created_at: '2023-06-20',
        tags: ['test'],
      };

      // Set the records in the collection
      specialCollection.set(importantRecord.id, {
        id: importantRecord.id,
        name: importantRecord.name,
        metadata: { status: '', createdAt: '', tags: [] },
      });
      specialCollection.set(archivedRecord.id, {
        id: archivedRecord.id,
        name: archivedRecord.name,
        metadata: { status: '', createdAt: '', tags: [] },
      });
      specialCollection.set(normalRecord.id, {
        id: normalRecord.id,
        name: normalRecord.name,
        metadata: { status: '', createdAt: '', tags: [] },
      });

      // Set the records in the simple collection
      simpleCollection.set(importantRecord.id, {
        id: importantRecord.id,
        name: importantRecord.name,
        metadata: {},
        created_at: importantRecord.created_at,
        tags: importantRecord.tags,
        status: '',
      });
      simpleCollection.set(archivedRecord.id, {
        id: archivedRecord.id,
        name: archivedRecord.name,
        metadata: {},
        created_at: archivedRecord.created_at,
        tags: archivedRecord.tags,
        status: '',
      });
      simpleCollection.set(normalRecord.id, {
        id: normalRecord.id,
        name: normalRecord.name,
        metadata: {},
        created_at: normalRecord.created_at,
        tags: normalRecord.tags,
        status: '',
      });

      specialCollection.debug = true;

      // Transport the records
      multiverse.transport(importantRecord.id, {
        collectionName: 'items',
        fromU: 'simple-universe',
        toU: 'special-universe',
      });
      multiverse.transport(archivedRecord.id, {
        collectionName: 'items',
        fromU: 'simple-universe',
        toU: 'special-universe',
      });
      multiverse.transport(normalRecord.id, {
        collectionName: 'items',
        fromU: 'simple-universe',
        toU: 'special-universe',
      });

      // Get the records
      const retrievedImportant = specialCollection.get(importantRecord.id);
      const retrievedArchived = specialCollection.get(archivedRecord.id);
      const retrievedNormal = specialCollection.get(normalRecord.id);

      // Verify the derived status values
      expect(retrievedImportant?.metadata.status).toBe('high-priority');
      expect(retrievedArchived?.metadata.status).toBe('inactive');
      expect(retrievedNormal?.metadata.status).toBe('normal');
    });

    it('should handle non-existent universal fields', () => {
      // Create a schema with non-existent universal fields
      const badSchema = new SchemaLocal<SimpleRecord>('items', {
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
            nonExistent: 'does_not_exist',
          },
          // Add import function to ensure metadata object is properly initialized
          import: () => {
            return {};
          },
        },
      });

      // Create a universe and collection
      const badUniverse = new Universe('bad-universe', multiverse);
      const badCollection = new CollSync<SimpleRecord, string>({
        name: 'items',
        universe: badUniverse,
        schema: badSchema,
      });
      badUniverse.add(badCollection);

      // Create a record
      const record = {
        id: 'item3',
        name: 'Bad Test',
        metadata: {},
      };

      // Set the record
      badCollection.set(record.id, record);

      // Get the record
      const retrievedRecord = badCollection.get(record.id);

      // Verify the metadata object was created but doesn't have the non-existent field
      expect(retrievedRecord).toBeDefined();
      expect(retrievedRecord?.metadata).toBeDefined();
      expect(retrievedRecord?.metadata).toEqual({});
    });
  });
});
