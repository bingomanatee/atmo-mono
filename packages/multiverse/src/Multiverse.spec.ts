import { beforeEach, describe, expect, it } from 'vitest';
import { CollSync } from './collections/CollSync';
import { FIELD_TYPES } from './constants';
import { Multiverse } from './Multiverse';
import { SchemaLocal } from './SchemaLocal';
import { SchemaUniversal } from './SchemaUniversal';
import type { DataRecord, MultiverseIF, UniverseIF } from './types.multiverse';
import { Universe } from './Universe';

// Define types for our test cases
type SnakeCaseUser = {
  id: number;
  full_name: string;
  home_address: string;
};

type DashCaseUser = {
  id: number;
  'full-name': string;
  'home-address': string;
};

// Define a type for camelCase users to match
type CamelCaseUser = {
  id: number;
  fullName: string;
  homeAddress: string;
};

const UPPER_FIELDS = {
  ID: { type: FIELD_TYPES.number, universalName: 'id' },
  FULL_NAME: { type: FIELD_TYPES.string, universalName: 'fullname' },
  HOME_ADDRESS: {
    type: FIELD_TYPES.string,
    universalName: 'homeaddress',
  },
};

// Schema definitions
const CAMEL_CASE_SCHEMA = {
  fields: {
    id: FIELD_TYPES.number,
    fullName: {
      type: FIELD_TYPES.string,
      // No universalName needed for camelCase as it's our "universal" format
    },
    homeAddress: {
      type: FIELD_TYPES.string,
      // No universalName needed for camelCase as it's our "universal" format
    },
  },
};

const SNAKE_CASE_SCHEMA = {
  fields: {
    id: FIELD_TYPES.number,
    full_name: {
      type: FIELD_TYPES.string,
      universalName: 'fullName', // Transform snake_case to camelCase
    },
    home_address: {
      type: FIELD_TYPES.string,
      universalName: 'homeAddress', // Transform snake_case to camelCase
    },
  },
};

type UpperUser = {
  ID: number;
  FULL_NAME: string;
  HOME_ADDRESS: string;
};

const universalSchema = new Map([
  [
    'users',
    new SchemaUniversal('users', {
      id: FIELD_TYPES.number,
      fullname: FIELD_TYPES.string,
      homeaddress: FIELD_TYPES.string,
    }),
  ],
]);

describe('Multiverse', () => {
  describe('*class', () => {
    it('should have no universes by default', () => {
      const m = new Multiverse(new Map());
      expect(m.has('foo')).toBe(false);
    });
  });

  describe('add', () => {
    let m: Multiverse;
    let u: UniverseIF;

    beforeEach(() => {
      m = new Multiverse(new Map());
      u = new Universe('foo');
    });

    it('should add a universe', () => {
      m.add(u);
      expect(m.has('foo')).toBe(true);
      expect(m.get('foo')).toEqual(u);
    });

    it('should throw an error if universe already exists', () => {
      m.add(u);
      expect(() => m.add(u)).toThrowError(/already exists/);
    });

    it('should replace an existing universe if replace is true', () => {
      const u2 = { ...u, systems: new Map() };
      m.add(u);
      m.add(u2, true);
      expect(m.get('foo')).toBe(u2);
    });
  });

  describe('localToUnivFieldMap', () => {
    let m: MultiverseIF;
    let upperUniv;
    let sc;
    let upperUsers;
    let snakeUsers;
    beforeEach(() => {
      m = new Multiverse(
        new Map([
          [
            'users',
            new SchemaUniversal('uses', {
              id: FIELD_TYPES.number,
              fullname: FIELD_TYPES.string,
              homeaddress: FIELD_TYPES.string,
            }),
          ],
        ]),
      );
      upperUniv = new Universe('uppercase', m);
      sc = new Universe('snakecase', m);
      upperUsers = new CollSync<UpperUser, number>({
        name: 'users',
        universe: upperUniv,
        schema: new SchemaLocal<UpperUser>('users', {
          ID: { type: FIELD_TYPES.number, universalName: 'id' },
          FULL_NAME: { type: FIELD_TYPES.string, universalName: 'fullname' },
          HOME_ADDRESS: {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        }),
      });
      snakeUsers = new CollSync<SnakeCaseUser>({
        name: 'users',
        universe: sc,
        schema: {
          fields: {
            id: { type: FIELD_TYPES.number, universalName: 'id' },
            'full-name': {
              type: FIELD_TYPES.string,
              universalName: 'fullname',
            },
            'home-address': {
              type: FIELD_TYPES.string,
              universalName: 'homeaddress',
            },
          },
        },
      });
    });

    it('should map universal fields to local fields', () => {
      upperUniv.add(upperUsers);

      const LM = m.localToUnivFieldMap(upperUsers, upperUniv.name);

      expect(LM).toEqual({
        FULL_NAME: 'fullname',
        ID: 'id',
        HOME_ADDRESS: 'homeaddress',
      });
    });

    it('should universally filter a record', () => {
      const record = {
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      };
      const result = m.toUniversal(record, upperUsers, upperUniv.name);
      expect(result).toEqual({
        id: 1,
        fullname: 'John Doe',
        homeaddress: '123 Main St',
      });
    });
  });
  describe('unversalizeLocalSchema', () => {
    let m: Multiverse;
    let upperUniv: Universe;
    let snakeUiverse: Universe;
    let upperUsers: CollSync<DataRecord, number>;
    let snakeUsers: CollSync<DataRecord, number>;

    beforeEach(() => {
      m = new Multiverse(
        new Map([
          [
            'users',
            new SchemaUniversal('users', {
              id: FIELD_TYPES.string,
              fullname: FIELD_TYPES.string,
              homeaddress: FIELD_TYPES.string,
            }),
          ],
        ]),
      );
      upperUniv = new Universe('uppercase', m);
      snakeUiverse = new Universe('snakecase', m);
      upperUsers = new CollSync<DataRecord, number>({
        name: 'users',
        universe: upperUniv,
        schema: new SchemaLocal('users', UPPER_FIELDS),
      });
      snakeUsers = new CollSync<DataRecord, number>({
        name: 'users',
        universe: snakeUiverse,
        schema: {
          fields: {
            id: { type: FIELD_TYPES.number, universalName: 'id' },
            'full-name': {
              type: FIELD_TYPES.string,
              universalName: 'fullname',
            },
            'home-address': {
              type: FIELD_TYPES.string,
              universalName: 'homeaddress',
            },
          },
        },
      });
    });

    it('should map local fields to universal fields', () => {
      const LM = m.localToUnivFieldMap(upperUsers, upperUniv.name);

      expect(LM).toEqual({
        FULL_NAME: 'fullname',
        HOME_ADDRESS: 'homeaddress',
        ID: 'id',
      });
    });

    it('should localize a record', () => {
      const record = {
        id: 1,
        fullname: 'John Doe',
        homeaddress: '123 Main St',
      };
      const result = m.toLocal(record, upperUsers, upperUniv.name);

      expect(result).toEqual({
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      });
    });
  });
  describe('transport', () => {
    let m: Multiverse;
    let upperUniv: Universe;
    let snakeUniv: Universe;
    let upperUsers: CollSync<DataRecord, number>;
    let snakeUsers: CollSync<DataRecord, number>;

    beforeEach(() => {
      m = new Multiverse(universalSchema);
      upperUniv = new Universe('uppercase', m);
      snakeUniv = new Universe('snakecase', m);

      upperUsers = new CollSync<DataRecord, number>({
        name: 'users',
        universe: upperUniv,
        schema: new SchemaLocal('users', {
          ID: { type: FIELD_TYPES.number, universalName: 'id' },
          FULL_NAME: { type: FIELD_TYPES.string, universalName: 'fullname' },
          HOME_ADDRESS: {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        }),
      });

      snakeUsers = new CollSync<DataRecord, number>({
        name: 'users',
        universe: snakeUniv,
        schema: new SchemaLocal('users', {
          id: FIELD_TYPES.number,
          'full-name': {
            type: FIELD_TYPES.string,
            universalName: 'fullname',
          },
          'home-address': {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        }),
      });

      // Add the collections to the universes
      upperUniv.add(upperUsers);
      snakeUniv.add(snakeUsers);
    });

    it('should transport a record from one universe to another', () => {
      const record = {
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      };

      upperUsers.set(record.ID, record);
      m.transport(1, {
        collectionName: 'users',
        fromU: upperUniv.name,
        toU: snakeUniv.name,
      });

      const snakeUser = snakeUniv!.get('users')!.get(1);

      expect(snakeUser).toEqual({
        id: 1,
        'full-name': 'John Doe',
        'home-address': '123 Main St',
      });
    });

    it('should transport a record the other way', () => {
      const record = {
        id: 1,
        'full-name': 'John Doe',
        'home-address': '123 Main St',
      };
      snakeUsers.set(record.id, record);
      m.transport(1, {
        collectionName: 'users',
        fromU: snakeUniv.name,
        toU: upperUniv.name,
      });

      const result = upperUniv.get('users')!.get(1);

      expect(result).toEqual({
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      });
    });
  });
});
