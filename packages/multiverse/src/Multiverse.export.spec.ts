import { get } from 'lodash-es';
import { beforeEach, describe, expect, it } from 'vitest';
import { CollSync } from './collections/CollSync';
import { FIELD_TYPES } from './constants';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import { Universe } from './Universe';

// Define types for our tests
type Planet = {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
};

type PlanetUniversal = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
};

type Event = {
  id: string;
  name: string;
  date: Date;
};

type EventUniversal = {
  id: string;
  name: string;
  date: string; // Date as ISO string
};

describe('Multiverse export and exportOnly functionality', () => {
  describe('exportOnly fields for nested objects', () => {
    let multiverse: Multiverse;
    let universe: Universe;
    let collection: CollSync<Planet, string>;

    beforeEach(() => {
      // Create a universal schema with flat x, y, z coordinates
      const universalSchema = new SchemaUniversal('planets', {
        id: FIELD_TYPES.string,
        name: FIELD_TYPES.string,
        x: FIELD_TYPES.number,
        y: FIELD_TYPES.number,
        z: FIELD_TYPES.number,
      });

      // Create a multiverse with the universal schema
      multiverse = new Multiverse(new Map([['planets', universalSchema]]));

      // Create a universe
      universe = new Universe('test-universe', multiverse);

      // Create a local schema with nested position object and exportOnly fields
      const schema = new SchemaLocal<Planet>('planets', {
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

      // Create the collection with the schema
      collection = new CollSync<Planet, string>({
        name: 'planets',
        universe,
        schema,
      });

      // Add the collection to the universe
      universe.add(collection);
    });

    it('should convert from local to universal using exportOnly fields', () => {
      // Create a planet with a nested position object
      const planet: Planet = {
        id: 'earth',
        name: 'Earth',
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
      };

      // Convert to universal
      const universal = multiverse.toUniversal<PlanetUniversal>(
        planet,
        collection,
        'test-universe',
      );

      // Check that the universal record has the flattened coordinates
      expect(universal).toEqual({
        id: 'earth',
        name: 'Earth',
        x: 1,
        y: 2,
        z: 3,
      });
    });

    it('should convert from universal to local without writing exportOnly fields', () => {
      // Create a universal planet with flat coordinates
      const universalPlanet: PlanetUniversal = {
        id: 'mars',
        name: 'Mars',
        x: 4,
        y: 5,
        z: 6,
      };

      // Convert to local
      const local = multiverse.toLocal(
        universalPlanet,
        collection,
        'test-universe',
      );

      // Check that the local record does not have the exportOnly fields
      expect(local).toEqual({
        id: 'mars',
        name: 'Mars',
      });

      // The position object would need to be created by a schema filter
      // in a real application, but we're just testing the exportOnly functionality here
    });

    it('should not write exportOnly fields to the record as a side effect', () => {
      // Create a planet with a nested position object
      const planet: Planet = {
        id: 'jupiter',
        name: 'Jupiter',
        position: {
          x: 7,
          y: 8,
          z: 9,
        },
      };

      // Make a copy of the original record
      const originalPlanet = JSON.parse(JSON.stringify(planet));

      // Convert to universal (this should use the exportOnly fields)
      const universal = multiverse.toUniversal<PlanetUniversal>(
        planet,
        collection,
        'test-universe',
      );

      // Check that the universal record has the flattened coordinates
      expect(universal).toEqual({
        id: 'jupiter',
        name: 'Jupiter',
        x: 7,
        y: 8,
        z: 9,
      });

      // Check that the original record was not modified
      expect(planet).toEqual(originalPlanet);

      // Specifically check that no exportOnly fields were added
      expect(planet).not.toHaveProperty('x');
      expect(planet).not.toHaveProperty('y');
      expect(planet).not.toHaveProperty('z');
    });

    it('should support dot notation in field paths using lodash get', () => {
      // Create a record with nested structure
      const record = {
        id: 'jupiter',
        coords: {
          x: 7,
          y: 8,
          z: 9,
        },
      };

      // Test that lodash get works with dot notation
      const result = {
        id: record.id,
        x: get(record, 'coords.x'),
        y: get(record, 'coords.y'),
        z: get(record, 'coords.z'),
      };

      // Check that the values are extracted correctly
      expect(result).toEqual({
        id: 'jupiter',
        x: 7,
        y: 8,
        z: 9,
      });
    });

    it('should support exportOnly fields with dot notation without filters', () => {
      // Create a universal schema with flat x, y, z coordinates
      const universalSchema = new SchemaUniversal('planets', {
        id: FIELD_TYPES.string,
        name: FIELD_TYPES.string,
        x: FIELD_TYPES.number,
        y: FIELD_TYPES.number,
        z: FIELD_TYPES.number,
      });

      // Create a multiverse with the universal schema
      const mv = new Multiverse(new Map([['planets', universalSchema]]));

      // Create a universe
      const univ = new Universe('test-universe', mv);

      // Create a local schema with nested position object and exportOnly fields using dot notation
      const schema = new SchemaLocal('planets', {
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

      const coll = new CollSync({
        name: 'planets',
        universe: univ,
        schema,
      });

      // Add the collection to the universe
      univ.add(coll);

      // Create a planet with a nested position object
      const planet = {
        id: 'earth',
        name: 'Earth',
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
      };

      // Convert to universal
      const universal = mv.toUniversal(planet, coll, 'test-universe');

      // Check that the universal record has the flattened coordinates
      expect(universal).toEqual({
        id: 'earth',
        name: 'Earth',
        x: 1,
        y: 2,
        z: 3,
      });
    });
  });

  describe('export function for data type conversion', () => {
    let multiverse: Multiverse;
    let universe: Universe;
    let collection: CollSync<Event, string>;

    beforeEach(() => {
      // Create a universal schema with date as string
      const universalSchema = new SchemaUniversal('events', {
        id: FIELD_TYPES.string,
        name: FIELD_TYPES.string,
        date: FIELD_TYPES.string, // Date stored as string in universal schema
      });

      // Create a multiverse with the universal schema
      multiverse = new Multiverse(new Map([['events', universalSchema]]));

      // Create a universe
      universe = new Universe('test-universe', multiverse);

      // Create a local schema with Date object and export function
      const schema = new SchemaLocal<Event>('events', {
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
          // Export function to convert Date to ISO string
          export: ({ newValue }) => {
            if (newValue instanceof Date) {
              return newValue.toISOString();
            }
            return newValue ? String(newValue) : '';
          },
        },
      });

      // Create the collection with the schema
      collection = new CollSync<Event, string>({
        name: 'events',
        universe,
        schema,
      });

      // Add the collection to the universe
      universe.add(collection);
    });

    it('should convert Date objects to strings when converting to universal', () => {
      // Create an event with a Date object
      const event: Event = {
        id: 'event1',
        name: 'Conference',
        date: new Date('2023-05-15T10:00:00Z'),
      };

      // Convert to universal
      const universal = multiverse.toUniversal<EventUniversal>(
        event,
        collection,
        'test-universe',
      );

      // Check that the date is converted to an ISO string
      expect(universal).toEqual({
        id: 'event1',
        name: 'Conference',
        date: '2023-05-15T10:00:00.000Z',
      });
    });

    it('should handle null or undefined date values', () => {
      // Create an event with a null date
      const event = {
        id: 'event2',
        name: 'Workshop',
        date: null,
      };

      // Convert to universal
      const universal = multiverse.toUniversal(
        event,
        collection,
        'test-universe',
      );

      // Check that the date is converted to an empty string
      expect(universal).toEqual({
        id: 'event2',
        name: 'Workshop',
        date: '',
      });
    });

    it('should handle non-Date objects passed as date values', () => {
      // Create an event with a string date
      const event = {
        id: 'event3',
        name: 'Meetup',
        date: '2023-06-20',
      };

      // Convert to universal
      const universal = multiverse.toUniversal(
        event,
        collection,
        'test-universe',
      );

      // Check that the date string is preserved
      expect(universal).toEqual({
        id: 'event3',
        name: 'Meetup',
        date: '2023-06-20',
      });
    });

    it('should not modify the original record when using export function', () => {
      // Create an event with a Date object
      const event: Event = {
        id: 'event4',
        name: 'Workshop',
        date: new Date('2023-07-10T14:00:00Z'),
      };

      // Make a copy of the original record
      const originalEvent = {
        id: event.id,
        name: event.name,
        date: new Date(event.date.getTime()), // Clone the Date object
      };

      // Convert to universal
      const universal = multiverse.toUniversal<EventUniversal>(
        event,
        collection,
        'test-universe',
      );

      // Check that the date is converted to an ISO string in the universal record
      expect(universal).toEqual({
        id: 'event4',
        name: 'Workshop',
        date: '2023-07-10T14:00:00.000Z',
      });

      // Check that the original record was not modified
      expect(event.id).toEqual(originalEvent.id);
      expect(event.name).toEqual(originalEvent.name);
      expect(event.date.getTime()).toEqual(originalEvent.date.getTime());

      // Check that no new properties were added
      expect(Object.keys(event).sort()).toEqual(['date', 'id', 'name']);
    });
  });
  describe('Object vs Array storage formats', () => {
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

      // 2. Array format schema
      const arraySchema = new SchemaUniversal('events', {
        id: FIELD_TYPES.string,
        data: FIELD_TYPES.array, // This will store [name, date, x, y, z]
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
      });

      // Add exportOnly fields for position coordinates
      objectLocalSchema.add({
        name: 'position.x',
        type: FIELD_TYPES.number,
        universalName: 'x',
        exportOnly: true,
      });

      objectLocalSchema.add({
        name: 'position.y',
        type: FIELD_TYPES.number,
        universalName: 'y',
        exportOnly: true,
      });

      objectLocalSchema.add({
        name: 'position.z',
        type: FIELD_TYPES.number,
        universalName: 'z',
        exportOnly: true,
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
        },
        position: {
          type: FIELD_TYPES.object,
        },
      });

      // Add exportOnly field that transforms the record into an array
      // For this case, we need to use an export function since we're creating a custom array format
      arrayLocalSchema.add({
        name: 'dataArray',
        type: FIELD_TYPES.array,
        universalName: 'data',
        exportOnly: true,
        export: ({ inputRecord }) => {
          // Format: [name, date, x, y, z]
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

      // Check the array format
      expect(arrayUniversal).toEqual({
        id: 'event1',
        data: ['Conference', '2023-05-15T10:00:00.000Z', 1, 2, 3],
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

      // Check that no exportOnly fields were added
      expect(event).not.toHaveProperty('data');
      expect(event).not.toHaveProperty('dataArray');
    });
  });
});
