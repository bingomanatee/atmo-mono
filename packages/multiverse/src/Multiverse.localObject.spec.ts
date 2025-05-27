import { describe, it, expect, beforeEach } from 'vitest';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import { FIELD_TYPES } from './constants';
import { CollSync } from './collections/CollSync';
import { Universe } from './Universe';

describe('Multiverse local object creation', () => {
  let multiverse: Multiverse;

  beforeEach(() => {
    // Create a new multiverse for each test
    multiverse = new Multiverse();
  });

  it('should create a local object when a field is marked as isLocal', () => {
    // Create a universal schema
    const universalSchema = new SchemaUniversal('items', {
      id: { type: FIELD_TYPES.string },
      name: { type: FIELD_TYPES.string },
    });

    // Create a local schema with a local object
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
        isLocal: true, // Mark as local-only
      },
    });

    // Register the universal schema
    multiverse.baseSchemas.set('items', universalSchema);

    // Create a universe and collection
    const universe = new Universe('test-universe', multiverse);
    const collection = new CollSync({
      name: 'items',
      universe,
      schema: localSchema,
    });
    universe.add(collection);

    // Create a universal record
    const universalRecord = {
      id: 'item1',
      name: 'Test Item',
    };

    // Convert to local format
    const localRecord = multiverse.toLocal(
      universalRecord,
      collection,
      'test-universe',
    );

    // Verify the local object was created
    expect(localRecord).toBeDefined();
    expect(localRecord.id).toBe('item1');
    expect(localRecord.name).toBe('Test Item');
    expect(localRecord.metadata).toBeDefined();
    expect(typeof localRecord.metadata).toBe('object');
  });

  it('should create a local object with import function', () => {
    // Create a universal schema
    const universalSchema = new SchemaUniversal('items', {
      id: { type: FIELD_TYPES.string },
      name: { type: FIELD_TYPES.string },
    });

    // Create a local schema with a local object and import function
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
        isLocal: true, // Mark as local-only
        import: () => {
          return {
            createdAt: new Date().toISOString(),
            status: 'new',
          };
        },
      },
    });

    // Register the universal schema
    multiverse.baseSchemas.set('items', universalSchema);

    // Create a universe and collection
    const universe = new Universe('test-universe', multiverse);
    const collection = new CollSync({
      name: 'items',
      universe,
      schema: localSchema,
    });
    universe.add(collection);

    // Create a universal record
    const universalRecord = {
      id: 'item1',
      name: 'Test Item',
    };

    // Convert to local format
    const localRecord = multiverse.toLocal(
      universalRecord,
      collection,
      'test-universe',
    );

    // Verify the local object was created with the import function
    expect(localRecord).toBeDefined();
    expect(localRecord.id).toBe('item1');
    expect(localRecord.name).toBe('Test Item');
    expect(localRecord.metadata).toBeDefined();
    expect(typeof localRecord.metadata).toBe('object');
    expect(localRecord.metadata.createdAt).toBeDefined();
    expect(localRecord.metadata.status).toBe('new');
  });

  it('should pull values from universal record into local object using univFields', () => {
    // Create a universal schema with metadata fields
    const universalSchema = new SchemaUniversal('items', {
      id: { type: FIELD_TYPES.string },
      name: { type: FIELD_TYPES.string },
      meta_created_at: { type: FIELD_TYPES.string },
      meta_status: { type: FIELD_TYPES.string },
      meta_tags: { type: FIELD_TYPES.array },
    });

    // Create a local schema with a local object that maps universal fields
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
          createdAt: 'meta_created_at',
          status: 'meta_status',
          tags: 'meta_tags',
        },
      },
    });

    // Register the universal schema
    multiverse.baseSchemas.set('items', universalSchema);

    // Create a universe and collection
    const universe = new Universe('test-universe', multiverse);
    const collection = new CollSync({
      name: 'items',
      universe,
      schema: localSchema,
    });
    universe.add(collection);

    // Create a universal record with metadata fields
    const universalRecord = {
      id: 'item1',
      name: 'Test Item',
      meta_created_at: '2023-06-15',
      meta_status: 'active',
      meta_tags: ['test', 'item'],
    };

    // Convert to local format
    const localRecord = multiverse.toLocal(
      universalRecord,
      collection,
      'test-universe',
    );

    // Verify the local object was created and populated with values from the universal record
    expect(localRecord).toBeDefined();
    expect(localRecord.id).toBe('item1');
    expect(localRecord.name).toBe('Test Item');
    expect(localRecord.metadata).toBeDefined();
    expect(typeof localRecord.metadata).toBe('object');
    expect(localRecord.metadata.createdAt).toBe('2023-06-15');
    expect(localRecord.metadata.status).toBe('active');
    expect(localRecord.metadata.tags).toEqual(['test', 'item']);
  });

  it('should use import function to transform universal values', () => {
    // Create a universal schema with metadata fields
    const universalSchema = new SchemaUniversal('items', {
      id: { type: FIELD_TYPES.string },
      name: { type: FIELD_TYPES.string },
      meta_created_at: { type: FIELD_TYPES.string },
      meta_status: { type: FIELD_TYPES.string },
    });

    // Create a local schema with a local object that uses import to transform values
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
        import: ({ currentRecord }) => {
          return {
            createdAt: currentRecord?.meta_created_at
              ? new Date(currentRecord.meta_created_at).toISOString()
              : new Date().toISOString(),
            status:
              currentRecord?.meta_status === 'active' ? 'enabled' : 'disabled',
            lastUpdated: new Date().toISOString(),
          };
        },
      },
      // Add fields to match the universal schema
      meta_created_at: {
        type: FIELD_TYPES.string,
        universalName: 'meta_created_at',
        exportOnly: true,
      },
      meta_status: {
        type: FIELD_TYPES.string,
        universalName: 'meta_status',
        exportOnly: true,
      },
    });

    // Register the universal schema
    multiverse.baseSchemas.set('items', universalSchema);

    // Create a universe and collection
    const universe = new Universe('test-universe', multiverse);
    const collection = new CollSync({
      name: 'items',
      universe,
      schema: localSchema,
    });
    universe.add(collection);

    // Create a universal record with metadata fields
    const universalRecord = {
      id: 'item1',
      name: 'Test Item',
      meta_created_at: '2023-06-15',
      meta_status: 'active',
    };

    // Convert to local format
    const localRecord = multiverse.toLocal(
      universalRecord,
      collection,
      'test-universe',
    );

    // Verify the local object was created and transformed values from the universal record
    expect(localRecord).toBeDefined();
    expect(localRecord.id).toBe('item1');
    expect(localRecord.name).toBe('Test Item');
    expect(localRecord.metadata).toBeDefined();
    expect(typeof localRecord.metadata).toBe('object');
    expect(localRecord.metadata.createdAt).toContain('2023-06-15');
    expect(localRecord.metadata.status).toBe('enabled');
    expect(localRecord.metadata.lastUpdated).toBeDefined();
  });
});
