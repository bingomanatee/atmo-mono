import { beforeEach, describe, expect, it } from 'vitest';
import { CollSync } from './collections/CollSync';
import { FIELD_TYPES } from './constants';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import { Universe } from './Universe';

// Define types for our tests
type FlatRecord = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
};

type NestedRecord = {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
};

describe('Multiverse local object instantiation', () => {
  describe('Creating local objects during transport', () => {
    let multiverse: Multiverse;
    let flatUniverse: Universe;
    let nestedUniverse: Universe;
    let flatCollection: CollSync<FlatRecord, string>;
    let nestedCollection: CollSync<NestedRecord, string>;

    beforeEach(() => {
      // Create a universal schema with flat x, y, z coordinates
      const universalSchema = new SchemaUniversal('objects', {
        id: FIELD_TYPES.string,
        name: FIELD_TYPES.string,
        x: FIELD_TYPES.number,
        y: FIELD_TYPES.number,
        z: FIELD_TYPES.number,
      });

      // Create a multiverse with the universal schema
      multiverse = new Multiverse(new Map([['objects', universalSchema]]));

      // Create universes
      flatUniverse = new Universe('flat-universe', multiverse);
      nestedUniverse = new Universe('nested-universe', multiverse);

      // Create a schema for the flat universe
      const flatSchema = new SchemaLocal<FlatRecord>('objects', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        x: {
          type: FIELD_TYPES.number,
          universalName: 'x',
        },
        y: {
          type: FIELD_TYPES.number,
          universalName: 'y',
        },
        z: {
          type: FIELD_TYPES.number,
          universalName: 'z',
        },
      });

      // Create a schema for the nested universe with position object
      const nestedSchema = new SchemaLocal<NestedRecord>('objects', {
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
          isLocal: true, // Mark as local-only
          // Use import function to ensure the position object is properly initialized
          import: ({ currentRecord }) => {
            // Create a position object with values from the universal record
            return {
              x: currentRecord?.x ?? 0,
              y: currentRecord?.y ?? 0,
              z: currentRecord?.z ?? 0,
            };
          },
        },
        'position.x': {
          type: FIELD_TYPES.number,
          universalName: 'x',
          exportOnly: true,
        },
        'position.y': {
          type: FIELD_TYPES.number,
          universalName: 'y',
          exportOnly: true,
        },
        'position.z': {
          type: FIELD_TYPES.number,
          universalName: 'z',
          exportOnly: true,
        },
      });

      // Create collections
      flatCollection = new CollSync<FlatRecord, string>({
        name: 'objects',
        universe: flatUniverse,
        schema: flatSchema,
      });

      nestedCollection = new CollSync<NestedRecord, string>({
        name: 'objects',
        universe: nestedUniverse,
        schema: nestedSchema,
      });

      // Add collections to universes
      flatUniverse.add(flatCollection);
      nestedUniverse.add(nestedCollection);
    });

    it('should create a nested position object when transporting from flat to nested universe', () => {
      // Create a flat record
      const flatRecord: FlatRecord = {
        id: 'obj1',
        name: 'Test Object',
        x: 10,
        y: 20,
        z: 30,
      };

      // Set the record in the flat collection
      flatCollection.set(flatRecord.id, flatRecord);

      // Transport the record to the nested universe
      multiverse.transport(flatRecord.id, {
        collectionName: 'objects',
        fromU: 'flat-universe',
        toU: 'nested-universe',
      });

      // Get the record from the nested collection
      const nestedRecord = nestedCollection.get(flatRecord.id);

      // Verify the record was transported and the position object was created
      expect(nestedRecord).toBeDefined();
      expect(nestedRecord?.id).toBe(flatRecord.id);
      expect(nestedRecord?.name).toBe(flatRecord.name);
      expect(nestedRecord?.position).toBeDefined();
      expect(nestedRecord?.position.x).toBe(flatRecord.x);
      expect(nestedRecord?.position.y).toBe(flatRecord.y);
      expect(nestedRecord?.position.z).toBe(flatRecord.z);
    });

    it('should create a nested position object when using collection.send', () => {
      // Create a flat record
      const flatRecord: FlatRecord = {
        id: 'obj2',
        name: 'Test Object 2',
        x: 15,
        y: 25,
        z: 35,
      };

      // Set the record in the flat collection
      flatCollection.set(flatRecord.id, flatRecord);

      // Send the record to the nested universe using collection.send
      flatCollection.send(flatRecord.id, 'nested-universe');

      // Get the record from the nested collection
      const nestedRecord = nestedCollection.get(flatRecord.id);

      // Verify the record was transported and the position object was created
      expect(nestedRecord).toBeDefined();
      expect(nestedRecord?.id).toBe(flatRecord.id);
      expect(nestedRecord?.name).toBe(flatRecord.name);
      expect(nestedRecord?.position).toBeDefined();
      expect(nestedRecord?.position.x).toBe(flatRecord.x);
      expect(nestedRecord?.position.y).toBe(flatRecord.y);
      expect(nestedRecord?.position.z).toBe(flatRecord.z);
    });

    it('should preserve existing position object values when transporting', () => {
      // Create a nested record with an existing position object
      const existingNestedRecord: NestedRecord = {
        id: 'obj3',
        name: 'Existing Object',
        position: {
          x: 100,
          y: 200,
          z: 300,
        },
      };

      // Set the record in the nested collection
      nestedCollection.set(existingNestedRecord.id, existingNestedRecord);

      // Create a flat record with the same ID but different values
      const flatRecord: FlatRecord = {
        id: 'obj3',
        name: 'Updated Object',
        x: 150,
        y: 250,
        z: 350,
      };

      // Set the record in the flat collection
      flatCollection.set(flatRecord.id, flatRecord);

      // Transport the record to the nested universe
      multiverse.transport(flatRecord.id, {
        collectionName: 'objects',
        fromU: 'flat-universe',
        toU: 'nested-universe',
      });

      // Get the updated record from the nested collection
      const updatedNestedRecord = nestedCollection.get(flatRecord.id);

      // Verify the record was transported and the position object was updated
      expect(updatedNestedRecord).toBeDefined();
      expect(updatedNestedRecord?.id).toBe(flatRecord.id);
      expect(updatedNestedRecord?.name).toBe(flatRecord.name);
      expect(updatedNestedRecord?.position).toBeDefined();
      expect(updatedNestedRecord?.position.x).toBe(flatRecord.x);
      expect(updatedNestedRecord?.position.y).toBe(flatRecord.y);
      expect(updatedNestedRecord?.position.z).toBe(flatRecord.z);
    });
  });
});
