import { beforeEach, describe, expect, it } from 'vitest';
import { CollSync } from './collections/CollSync';
import { FIELD_TYPES } from './constants';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import { Universe } from './Universe';

describe('Multiverse array format', () => {
  describe('True array storage format', () => {
    let multiverse: Multiverse;
    let objectUniverse: Universe;
    let arrayUniverse: Universe;
    let objectCollection: CollSync<any, string>;
    let arrayCollection: CollSync<any, string>;

    beforeEach(() => {
      // Create universal schemas
      // 1. Object format schema
      const objectSchema = new SchemaUniversal('events', {
        id: FIELD_TYPES.string,
        name: FIELD_TYPES.string,
        date: FIELD_TYPES.string,
        x: FIELD_TYPES.number,
        y: FIELD_TYPES.number,
        z: FIELD_TYPES.number,
      });

      // 2. Array format schema - this will store records as literal arrays
      const arraySchema = new SchemaUniversal('events', {
        id: FIELD_TYPES.string, // We still need an ID field for record identification
        // The rest of the record will be stored as a literal array
      });

      // Create a multiverse with both schemas
      multiverse = new Multiverse(
        new Map([
          ['events-object', objectSchema],
          ['events-array', arraySchema],
        ]),
      );

      // Create universes
      objectUniverse = new Universe('object-universe', multiverse);
      arrayUniverse = new Universe('array-universe', multiverse);

      // Create a local schema for the object universe
      const objectLocalSchema = new SchemaLocal<any>('events', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
          universalName: 'name',
        },
        date: {
          type: FIELD_TYPES.date,
          universalName: 'date',
          export: ({ newValue }) => {
            if (newValue instanceof Date) {
              return newValue.toISOString();
            }
            return newValue ? String(newValue) : '';
          },
        },
        position: {
          type: FIELD_TYPES.object,
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

      // Create a local schema for the array universe
      const arrayLocalSchema = new SchemaLocal<any>('events', {
        id: {
          type: FIELD_TYPES.string,
          universalName: 'id',
        },
        name: {
          type: FIELD_TYPES.string,
        },
        date: {
          type: FIELD_TYPES.date,
          export: ({ newValue }) => {
            if (newValue instanceof Date) {
              return newValue.toISOString();
            }
            return newValue ? String(newValue) : '';
          },
        },
        position: {
          type: FIELD_TYPES.object,
        },
        // Add a field that will be an array in the universal schema
        arrayData: {
          type: FIELD_TYPES.array,
          universalName: 'arrayData',
          exportOnly: true,
          export: ({ inputRecord }) => {
            // Create an array from the record's fields
            return [
              inputRecord.name,
              inputRecord.date instanceof Date
                ? inputRecord.date.toISOString()
                : '',
              inputRecord.position?.x ?? 0,
              inputRecord.position?.y ?? 0,
              inputRecord.position?.z ?? 0,
            ];
          },
        },
      });

      // Create collections
      objectCollection = new CollSync<any, string>({
        name: 'events-object',
        universe: objectUniverse,
        schema: objectLocalSchema,
      });

      arrayCollection = new CollSync<any, string>({
        name: 'events-array',
        universe: arrayUniverse,
        schema: arrayLocalSchema,
      });

      // Add collections to universes
      objectUniverse.add(objectCollection);
      arrayUniverse.add(arrayCollection);
    });

    it('should store the same data in object and array formats', () => {
      // Create a test record
      const event = {
        id: 'event1',
        name: 'Conference',
        date: new Date('2023-05-15T10:00:00Z'),
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
      };

      // Convert to object format
      const objectUniversal = multiverse.toUniversal(
        event,
        objectCollection,
        'object-universe',
      );

      // Convert to array format
      const arrayUniversal = multiverse.toUniversal(
        event,
        arrayCollection,
        'array-universe',
      );

      // Check the object format
      expect(objectUniversal).toEqual({
        id: 'event1',
        name: 'Conference',
        date: '2023-05-15T10:00:00.000Z',
        x: 1,
        y: 2,
        z: 3,
      });

      // Check the array format - this should have an array field
      expect(arrayUniversal).toEqual({
        id: 'event1',
        arrayData: ['Conference', '2023-05-15T10:00:00.000Z', 1, 2, 3],
      });

      // Check that the original record was not modified
      expect(event).toEqual({
        id: 'event1',
        name: 'Conference',
        date: expect.any(Date),
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
      });

      // Verify the date is still a Date object
      expect(event.date).toBeInstanceOf(Date);

      // Check that no array indices were added to the original record
      expect(event).not.toHaveProperty('0');
      expect(event).not.toHaveProperty('1');
      expect(event).not.toHaveProperty('2');
    });

    it('should not include exportOnly fields when converting to local format', () => {
      // Create a record in array format (as it would be stored in the universal store)
      const arrayRecord = {
        id: 'event2',
        arrayData: ['Workshop', '2023-06-20T09:00:00.000Z', 4, 5, 6],
      };

      // Convert from array format to local object format
      const localRecord = multiverse.toLocal(
        arrayRecord,
        arrayCollection,
        'array-universe',
      );

      // Check that the record was properly converted back to object format
      // Note: The exportOnly field should not be included in the local record
      expect(localRecord).toEqual({
        id: 'event2',
      });

      // Check that the arrayData field is not included in the local record
      expect(localRecord).not.toHaveProperty('arrayData');
    });
  });
});
