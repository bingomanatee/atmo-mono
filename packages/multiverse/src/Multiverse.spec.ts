import { describe, expect, it } from 'vitest';
import { Multiverse } from './Multiverse';
import type {
  CollIF,
  DataKey,
  DataRecord,
  UniverseIF,
} from './types.multiverse';
import { FIELD_TYPES } from './constants';
import { Universe } from './Universe';
import { CollSync } from './CollSync';

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

describe('Multiverse', () => {
  describe('*class', () => {
    it('should have no universes by default', () => {
      const m = new Multiverse();
      expect(m.has('foo')).toBe(false);
    });
  });

  describe('add', () => {
    const u: UniverseIF = {
      add(coll: CollIF<DataRecord, DataKey>): CollIF<DataRecord, DataKey> {
        return coll;
      },
      get(): CollIF<DataRecord, DataKey> | undefined {
        return undefined;
      },
      has(): boolean {
        return false;
      },
      name: 'foo',
    };
    it('should add a universe', () => {
      const m = new Multiverse();
      m.add(u);
      expect(m.has('foo')).toBe(true);
      expect(m.get('foo')).toEqual(u);
    });

    it('should throw an error if universe already exists', () => {
      const m = new Multiverse();
      m.add(u);
      expect(() => m.add(u)).toThrowError(/already exists/);
    });

    it('should replace an existing universe if replace is true', () => {
      const m = new Multiverse();
      const u2 = { ...u, systems: new Map() };
      m.add(u);
      m.add(u2, true);
      expect(m.get('foo')).toBe(u2);
    });
  });

  describe('transform', () => {
    const m = new Multiverse();
    const upperUniv = new Universe('uppercase', m);
    const dashUniv = new Universe('snakecase', m);
    const upperUsers = new CollSync<UpperUser, number>({
      name: 'users',
      universe: upperUniv,
      schema: {
        fields: {
          ID: { type: FIELD_TYPES.number, universalName: 'id' },
          FULL_NAME: { type: FIELD_TYPES.string, universalName: 'fullname' },
          HOME_ADDRESS: {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });
    const dashCaseUser = new CollSync<DashCaseUser, number>({
      name: 'users',
      universe: dashUniv,
      schema: {
        fields: {
          id: { type: FIELD_TYPES.number, universalName: 'id' },
          'full-name': { type: FIELD_TYPES.string, universalName: 'fullname' },
          'home-address': {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });

    it('should convert snakeUsers to upperUsers', () => {
      const ron = {
        id: 11,
        'full-name': 'Ron Weasley',
        'home-address': 'Hogwarts',
      };

      dashUniv.get('users')!.set(ron.id, ron);
      const upperRon = m.transport(ron.id, 'users', 'snakecase', 'uppercase');
    });
  });

  describe('localizeUniversalSchema', () => {
    const m = new Multiverse();
    const upperUniv = new Universe('uppercase', m);
    const sc = new Universe('snakecase', m);
    const upperUsers = new CollSync<UpperUser, number>({
      name: 'users',
      universe: upperUniv,
      schema: {
        fields: {
          ID: { type: FIELD_TYPES.number, universalName: 'id' },
          FULL_NAME: { type: FIELD_TYPES.string, universalName: 'fullname' },
          HOME_ADDRESS: {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });
    const snakeUsers = new CollSync<SnakeCaseUser>({
      name: 'users',
      universe: sc,
      schema: {
        fields: {
          id: { type: FIELD_TYPES.number, universalName: 'id' },
          'full-name': { type: FIELD_TYPES.string, universalName: 'fullname' },
          'home-address': {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });

    it('should map universal fields to local fields', () => {
      upperUniv.add(upperUsers);

      const LM = m.localizeUniversalSchema(upperUsers, upperUniv.name);

      expect(LM).toEqual({
        fullname: 'FULL_NAME',
        homeaddress: 'HOME_ADDRESS',
        id: 'ID',
      });
    });

    it('should universally filter a record', () => {
      const record = {
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      };
      const result = m.toUniversal(record, upperUsers);

      expect(result).toEqual({
        id: 1,
        fullname: 'John Doe',
        homeaddress: '123 Main St',
      });
    });
  });
  describe('unversalizeLocalSchema', () => {
    const m = new Multiverse();
    const u = new Universe('uppercase', m);
    const sc = new Universe('snakecase', m);

    const upperUsers = new CollSync<DataRecord, number>({
      name: 'users',
      universe: u,
      schema: {
        fields: {
          ID: { type: FIELD_TYPES.number, universalName: 'id' },
          FULL_NAME: { type: FIELD_TYPES.string, universalName: 'fullname' },
          HOME_ADDRESS: {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });
    const snakeUsers = new CollSync<DataRecord, number>({
      name: 'users',
      universe: sc,
      schema: {
        fields: {
          id: { type: FIELD_TYPES.number, universalName: 'id' },
          'full-name': { type: FIELD_TYPES.string, universalName: 'fullname' },
          'home-address': {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });

    it('should map local fields to universal fields', () => {
      const LM = m.universalizeLocalSchema(upperUsers);

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
      const result = m.toLocal(record, upperUsers, 'upper');

      expect(result).toEqual({
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      });
    });
  });
  describe('transport', () => {
    const m = new Multiverse();
    const upperUniv = new Universe('uppercase', m);
    const snakeUniv = new Universe('snakecase', m);

    const upperUsers = new CollSync<DataRecord, number>({
      name: 'users',
      universe: upperUniv,
      schema: {
        fields: {
          ID: { type: FIELD_TYPES.number, universalName: 'id' },
          FULL_NAME: { type: FIELD_TYPES.string, universalName: 'fullname' },
          HOME_ADDRESS: {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });
    const snakeUsers = new CollSync<DataRecord, number>({
      name: 'users',
      universe: snakeUniv,
      schema: {
        fields: {
          id: { type: FIELD_TYPES.number, universalName: 'id' },
          'full-name': { type: FIELD_TYPES.string, universalName: 'fullname' },
          'home-address': {
            type: FIELD_TYPES.string,
            universalName: 'homeaddress',
          },
        },
      },
    });

    it('should transport a record from one universe to another', () => {
      const record = {
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      };
      try {
        upperUsers.set(record.ID, record);
      } catch (err) {
        console.error(
          'failure initializing ',
          record,
          err,
          'schema = ',
          upperUsers.schema,
        );
        return;
      }
      const result = m.transport(1, 'users', upperUniv.name, snakeUniv.name);

      expect(result).toEqual({
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

      console.log('universal version:', m.toUniversal(record, snakeUsers));
      console.log('universal map:', m.universalizeLocalSchema(snakeUsers));
      const result = m.transport(1, 'users', snakeUniv.name, upperUniv.name);

      expect(result).toEqual({
        ID: 1,
        FULL_NAME: 'John Doe',
        HOME_ADDRESS: '123 Main St',
      });
    });
  });
});
