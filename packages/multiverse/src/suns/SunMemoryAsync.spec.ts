import { beforeEach, describe, expect, it } from 'vitest';
import { SunMemoryAsync } from './SunMemoryAsync.ts';
import { FIELD_TYPES } from '../constants';
import type { CollAsyncIF } from '../types.coll';
import { SchemaLocal } from '../SchemaLocal';
import { CollAsync } from '../CollAsync';
import { Universe } from '../Universe';
import type { PostParams } from '../type.schema';

type User = { id: number; name: string; age?: number; email?: string };

describe('SunMemoryAsync', () => {
  let univ: Universe;
  let schema: SchemaLocal;
  let coll: CollAsyncIF<User, number>;
  let sun: SunMemoryAsync<User, number>;

  beforeEach(() => {
    univ = new Universe('test-universe');
    schema = new SchemaLocal('users', {
      id: { type: FIELD_TYPES.number },
      name: { type: FIELD_TYPES.string, universalName: 'username' },
      age: { type: FIELD_TYPES.number, meta: { optional: true } },
      email: { type: FIELD_TYPES.string, meta: { optional: true } },
    });
    coll = new CollAsync({
      name: 'users',
      schema,
      universe: univ,
    });
    sun = new SunMemoryAsync<User, number>(coll);
  });

  describe('constructor', () => {
    it('should create a new instance with an empty data map', async () => {
      expect(sun).toBeInstanceOf(SunMemoryAsync);
      expect(await sun.has(1)).toBe(false);
    });
  });

  describe('basic operations', () => {
    describe('get', () => {
      it('should return undefined for missing records', () => {
        const result = sun.get(1);
        expect(result).toBeUndefined();
      });

      it('should return the record if it exists', async () => {
        const user = { id: 1, name: 'John Doe' };
        await sun.set(1, user);
        expect(sun.get(1)).toEqual(user);
      });
    });

    describe('has', () => {
      it('should return false for missing records', async () => {
        expect(await sun.has(1)).toBe(false);
      });

      it('should return true if the record exists', async () => {
        await sun.set(1, { id: 1, name: 'John Doe' });
        expect(await sun.has(1)).toBe(true);
      });
    });

    describe('delete', () => {
      it('should remove a record', async () => {
        await sun.set(1, { id: 1, name: 'John Doe' });
        expect(await sun.has(1)).toBe(true);

        await sun.delete(1);
        expect(await sun.has(1)).toBe(false);
        expect(sun.get(1)).toBeUndefined();
      });

      it('should do nothing if the record does not exist', async () => {
        expect(await sun.has(1)).toBe(false);
        await sun.delete(1);
        expect(await sun.has(1)).toBe(false);
      });
    });

    describe('clear', () => {
      it('should remove all records', async () => {
        await sun.set(1, { id: 1, name: 'John Doe' });
        await sun.set(2, { id: 2, name: 'Jane Smith' });

        expect(await sun.has(1)).toBe(true);
        expect(await sun.has(2)).toBe(true);

        sun.clear();

        expect(await sun.has(1)).toBe(false);
        expect(await sun.has(2)).toBe(false);
      });
    });
  });

  describe('set', () => {
    it('should add a new record', async () => {
      const user = { id: 1, name: 'John Doe' };
      await sun.set(1, user);

      expect(await sun.has(1)).toBe(true);
      expect(sun.get(1)).toEqual(user);
    });

    it('should update an existing record', async () => {
      await sun.set(1, { id: 1, name: 'John Doe' });
      await sun.set(1, { id: 1, name: 'John Updated' });

      expect(sun.get(1)).toEqual({ id: 1, name: 'John Updated' });
    });

    it('should create a copy of the input object', async () => {
      const user = { id: 1, name: 'John Doe' };
      await sun.set(1, user);

      // Modify the original object
      user.name = 'Modified Name';

      // The stored object should not be affected
      expect(sun.get(1)).toEqual({ id: 1, name: 'John Doe' });
    });

    it('should throw an error if input is not an object', async () => {
      try {
        // @ts-ignore - Testing runtime behavior
        await sun.set(1, 'not an object');
        // If we get here, the test should fail
        expect('should have thrown').toBe('but did not throw');
      } catch (error) {
        // Verify the error message
        expect(String(error)).toMatch(/input must be an object/);
      }
    });

    it('should validate field types for id', async () => {
      try {
        // @ts-ignore - Testing runtime behavior
        await sun.set(1, { id: 'not a number', name: 'John Doe' });
        // If we get here, the test should fail
        expect('should have thrown').toBe('but did not throw');
      } catch (error) {
        // Verify the error message
        expect(String(error)).toMatch(/validation error/);
      }
    });

    it('should validate field types for name', async () => {
      try {
        // @ts-ignore - Testing runtime behavior
        await sun.set(1, { id: 1, name: 123 });
        // If we get here, the test should fail
        expect('should have thrown').toBe('but did not throw');
      } catch (error) {
        // Verify the error message
        expect(String(error)).toMatch(/validation error/);
      }
    });

    it('should allow optional fields to be undefined', async () => {
      // Just verify that this doesn't throw an error
      await sun.set(1, { id: 1, name: 'John Doe' });
      // If we get here, the test passes
      expect(true).toBe(true);
    });

    it('should validate optional fields when provided', async () => {
      try {
        // @ts-ignore - Testing runtime behavior
        await sun.set(1, { id: 1, name: 'John Doe', age: 'not a number' });
        // If we get here, the test should fail
        expect('should have thrown').toBe('but did not throw');
      } catch (error) {
        // Verify the error message
        expect(String(error)).toMatch(/validation error/);
      }
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

      coll = new CollAsync({
        name: 'users',
        schema,
        universe: univ,
      });

      sun = new SunMemoryAsync<User, number>(coll);
    });

    it('should apply field filters when setting a record', async () => {
      await sun.set(1, { id: 1, name: 'John Doe', email: 'JOHN@EXAMPLE.COM' });

      const result = sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'JOHN DOE',
        email: 'john@example.com',
      });
    });

    it('should handle existing records in field filters', async () => {
      await sun.set(1, { id: 1, name: 'John Doe' });

      // Update with a new record
      await sun.set(1, {
        id: 1,
        name: 'Jane Smith',
        email: 'jane@example.com',
      });

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

      coll = new CollAsync({
        name: 'users',
        schema,
        universe: univ,
      });

      sun = new SunMemoryAsync<User & { lastUpdated?: string }, number>(coll);
    });

    it('should apply record filter when setting a record', async () => {
      await sun.set(1, { id: 1, name: 'John Doe' });

      const result = sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        lastUpdated: 'filtered',
      });
    });

    it('should apply record filter after field filters', async () => {
      // Add a field filter
      schema.fields.name.filter = (params: PostParams) => {
        return params.newValue ? String(params.newValue).toUpperCase() : '';
      };

      await sun.set(1, { id: 1, name: 'John Doe' });

      const result = sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'JOHN DOE',
        lastUpdated: 'filtered',
      });
    });
  });
});
