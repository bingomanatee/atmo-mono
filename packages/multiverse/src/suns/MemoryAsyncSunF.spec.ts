import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemorySunF } from './MemorySunF';
import { FIELD_TYPES } from '../constants';
import type { CollSyncIF } from '../types.coll';
import { SchemaLocal } from '../SchemaLocal';
import { CollSync } from '../CollSync';
import { Universe } from '../Universe';
import type { PostParams, SchemaLocalFieldIF } from '../type.schema';

type User = { id: number; name: string; age?: number; email?: string };

describe('MemorySunF', () => {
  let univ: Universe;
  let schema: SchemaLocal;
  let coll: CollSyncIF<User, number>;
  let sun: MemorySunF<User, number>;

  beforeEach(() => {
    univ = new Universe('test-universe');
    schema = new SchemaLocal('users', {
      id: { type: FIELD_TYPES.number },
      name: { type: FIELD_TYPES.string, universalName: 'username' },
      age: { type: FIELD_TYPES.number, meta: { optional: true } },
      email: { type: FIELD_TYPES.string, meta: { optional: true } },
    });
    coll = new CollSync({
      name: 'users',
      schema,
      universe: univ,
    });
    sun = new MemorySunF<User, number>(coll);
  });

  describe('constructor', () => {
    it('should create a new instance with an empty data map', () => {
      expect(sun).toBeInstanceOf(MemorySunF);
      expect(sun.has(1)).toBe(false);
    });
  });

  describe('basic operations', () => {
    describe('get', () => {
      it('should return undefined for missing records', () => {
        const result = sun.get(1);
        expect(result).toBeUndefined();
      });

      it('should return the record if it exists', () => {
        const user = { id: 1, name: 'John Doe' };
        sun.set(1, user);
        expect(sun.get(1)).toEqual(user);
      });
    });

    describe('has', () => {
      it('should return false for missing records', () => {
        expect(sun.has(1)).toBe(false);
      });

      it('should return true if the record exists', () => {
        sun.set(1, { id: 1, name: 'John Doe' });
        expect(sun.has(1)).toBe(true);
      });
    });

    describe('delete', () => {
      it('should remove a record', () => {
        sun.set(1, { id: 1, name: 'John Doe' });
        expect(sun.has(1)).toBe(true);

        sun.delete(1);
        expect(sun.has(1)).toBe(false);
        expect(sun.get(1)).toBeUndefined();
      });

      it('should do nothing if the record does not exist', () => {
        expect(sun.has(1)).toBe(false);
        sun.delete(1);
        expect(sun.has(1)).toBe(false);
      });
    });

    describe('clear', () => {
      it('should remove all records', () => {
        sun.set(1, { id: 1, name: 'John Doe' });
        sun.set(2, { id: 2, name: 'Jane Smith' });

        expect(sun.has(1)).toBe(true);
        expect(sun.has(2)).toBe(true);

        sun.clear();

        expect(sun.has(1)).toBe(false);
        expect(sun.has(2)).toBe(false);
      });
    });
  });

  describe('set', () => {
    it('should add a new record', () => {
      const user = { id: 1, name: 'John Doe' };
      sun.set(1, user);

      expect(sun.has(1)).toBe(true);
      expect(sun.get(1)).toEqual(user);
    });

    it('should update an existing record', () => {
      sun.set(1, { id: 1, name: 'John Doe' });
      sun.set(1, { id: 1, name: 'John Updated' });

      expect(sun.get(1)).toEqual({ id: 1, name: 'John Updated' });
    });

    it('should create a copy of the input object', () => {
      const user = { id: 1, name: 'John Doe' };
      sun.set(1, user);

      // Modify the original object
      user.name = 'Modified Name';

      // The stored object should not be affected
      expect(sun.get(1)).toEqual({ id: 1, name: 'John Doe' });
    });

    it('should throw an error if input is not an object', () => {
      expect(() => {
        // @ts-ignore - Testing runtime behavior
        sun.set(1, 'not an object');
      }).toThrow(/input must be an object/);
    });

    it('should validate field types', () => {
      expect(() => {
        // @ts-ignore - Testing runtime behavior
        sun.set(1, { id: 'not a number', name: 'John Doe' });
      }).toThrow(/validation error/);

      expect(() => {
        // @ts-ignore - Testing runtime behavior
        sun.set(1, { id: 1, name: 123 });
      }).toThrow(/validation error/);
    });

    it('should allow optional fields to be undefined', () => {
      expect(() => {
        sun.set(1, { id: 1, name: 'John Doe' });
      }).not.toThrow();
    });

    it('should validate optional fields when provided', () => {
      expect(() => {
        // @ts-ignore - Testing runtime behavior
        sun.set(1, { id: 1, name: 'John Doe', age: 'not a number' });
      }).toThrow(/validation error/);
    });
  });

  describe('field filters', () => {
    beforeEach(() => {
      // Create a schema with a field filter
      schema = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
        name: {
          type: FIELD_TYPES.string,
          filter: (params: PostParams) => {
            return params.newValue ? String(params.newValue).toUpperCase() : '';
          },
        },
        email: {
          type: FIELD_TYPES.string,
          meta: { optional: true },
          filter: (params: PostParams) => {
            return params.newValue ? String(params.newValue).toLowerCase() : '';
          },
        },
      });

      coll = new CollSync({
        name: 'users',
        schema,
        universe: univ,
      });

      sun = new MemorySunF<User, number>(coll);
    });

    it('should apply field filters when setting a record', () => {
      sun.set(1, { id: 1, name: 'John Doe', email: 'JOHN@EXAMPLE.COM' });

      const result = sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'JOHN DOE',
        email: 'john@example.com',
      });
    });

    it('should handle existing records in field filters', () => {
      sun.set(1, { id: 1, name: 'John Doe' });

      // Update with a new record
      sun.set(1, { id: 1, name: 'Jane Smith', email: 'jane@example.com' });

      const result = sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'JANE SMITH',
        email: 'jane@example.com',
      });
    });
  });

  describe('record filter', () => {
    beforeEach(() => {
      // Create a schema with a record filter
      schema = new SchemaLocal(
        'users',
        {
          id: { type: FIELD_TYPES.number },
          name: { type: FIELD_TYPES.string },
          email: { type: FIELD_TYPES.string, meta: { optional: true } },
        },
        (params: PostParams) => {
          const record = params.inputRecord as User;
          return {
            ...record,
            lastUpdated: 'filtered',
          };
        },
      );

      coll = new CollSync({
        name: 'users',
        schema,
        universe: univ,
      });

      sun = new MemorySunF<User & { lastUpdated?: string }, number>(coll);
    });

    it('should apply record filter when setting a record', () => {
      sun.set(1, { id: 1, name: 'John Doe' });

      const result = sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        lastUpdated: 'filtered',
      });
    });

    it('should apply record filter after field filters', () => {
      // Add a field filter
      schema.fields.name.filter = (params: PostParams) => {
        return params.newValue ? String(params.newValue).toUpperCase() : '';
      };

      sun.set(1, { id: 1, name: 'John Doe' });

      const result = sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'JOHN DOE',
        lastUpdated: 'filtered',
      });
    });
  });
});
