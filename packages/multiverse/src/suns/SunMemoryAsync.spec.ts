import { beforeEach, describe, expect, it } from 'vitest';
import { CollAsync } from '../collections/CollAsync';
import { FIELD_TYPES, MUTATION_ACTIONS } from '../constants';
import { SchemaLocal } from '../SchemaLocal';
import type { PostParams } from '../type.schema';
import type { CollAsyncIF } from '../types.coll';
import { Universe } from '../Universe';
import { SunMemoryAsync } from './SunMemoryAsync';

type User = { id: number; name: string; age?: number; email?: string };
const TEST_ERROR = 'Test Error';
describe('SunMemoryAsync', () => {
  let univ: Universe;
  let schema: SchemaLocal;
  let coll: CollAsyncIF<User, number>;

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
      sunF(coll) {
        return new SunMemoryAsync<User, number>(coll);
      },
    });
  });

  describe('constructor', () => {
    it('should create a new instance with an empty data map', async () => {
      expect(coll.sun).toBeInstanceOf(SunMemoryAsync);
      expect(await coll.sun.has(1)).toBe(false);
    });
  });

  describe('basic operations', () => {
    describe('get', () => {
      it('should return undefined for missing records', async () => {
        const result = await coll.sun.get(1);
        expect(result).toBeUndefined();
      });

      it('should return the record if it exists', async () => {
        const user = { id: 1, name: 'John Doe' };
        await coll.sun.set(1, user);
        expect(await coll.sun.get(1)).toEqual(user);
      });
    });

    describe('has', () => {
      it('should return false for missing records', async () => {
        expect(await coll.sun.has(1)).toBe(false);
      });

      it('should return true if the record exists', async () => {
        await coll.sun.set(1, { id: 1, name: 'John Doe' });
        expect(await coll.sun.has(1)).toBe(true);
      });
    });

    describe('delete', () => {
      it('should remove a record', async () => {
        await coll.sun.set(1, { id: 1, name: 'John Doe' });
        expect(await coll.sun.has(1)).toBe(true);

        await coll.sun.delete(1);
        expect(await coll.sun.has(1)).toBe(false);
      });

      it('should do nothing if the record does not exist', async () => {
        expect(await coll.sun.has(1)).toBe(false);
        await coll.sun.delete(1);
        expect(await coll.sun.has(1)).toBe(false);
      });
    });

    describe('clear', () => {
      it('should remove all records', async () => {
        await coll.sun.set(1, { id: 1, name: 'John Doe' });
        await coll.sun.set(2, { id: 2, name: 'Jane Smith' });

        expect(await coll.sun.has(1)).toBe(true);
        expect(await coll.sun.has(2)).toBe(true);

        coll.sun.clear();

        expect(await coll.sun.has(1)).toBe(false);
        expect(await coll.sun.has(2)).toBe(false);
      });
    });
  });

  describe('set', () => {
    it('should add a new record', async () => {
      const user = { id: 1, name: 'John Doe' };
      await coll.sun.set(1, user);

      expect(await coll.sun.has(1)).toBe(true);
      expect(await coll.sun.get(1)).toEqual(user);
    });

    it('should update an existing record', async () => {
      await coll.sun.set(1, { id: 1, name: 'John Doe' });
      await coll.sun.set(1, { id: 1, name: 'John Updated' });

      expect(await coll.sun.get(1)).toEqual({ id: 1, name: 'John Updated' });
    });

    it('should validate field types for id', async () => {
      await expect(async () => {
        await coll.sun.set(1, { id: 'not a number', name: 'John Doe' });
      }).rejects.toThrow(/validation.*id/);
    });

    it('should validate field types for name', async () => {
      try {
        // @ts-ignore - Testing runtime behavior
        await coll.sun.set(1, { id: 1, name: 123 });
        // If we get here, the test should fail
        expect('should have thrown').toBe('but did not throw');
      } catch (error) {
        // Verify the error message
        expect(String(error)).toMatch(/validation error/);
      }
    });

    it('should allow optional fields to be undefined', async () => {
      // Just verify that this doesn't throw an error
      await coll.sun.set(1, { id: 1, name: 'John Doe' });
      // If we get here, the test passes
      expect(true).toBe(true);
    });

    it('should validate optional fields when provided', async () => {
      try {
        // @ts-ignore - Testing runtime behavior
        await coll.sun.set(1, { id: 1, name: 'John Doe', age: 'not a number' });
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
        sunF(coll) {
          return new SunMemoryAsync<User, number>(coll);
        },
      });
    });

    it('should apply field filters when setting a record', async () => {
      await coll.sun.set(1, { id: 1, name: 'John Doe', email: 'JOHN@EXAMPLE.COM' });

      const result = await coll.sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'JOHN DOE',
        email: 'john@example.com',
      });
    });

    it('should handle existing records in field filters', async () => {
      await coll.sun.set(1, { id: 1, name: 'John Doe' });

      // Update with a new record
      await coll.sun.set(1, {
        id: 1,
        name: 'Jane Smith',
        email: 'jane@example.com',
      });

      const result = await coll.sun.get(1);

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
        sunF(coll) {
          return new SunMemoryAsync<User & { lastUpdated?: string }, number>(coll);
        },
      });
    });

    it('should apply record filter when setting a record', async () => {
      await coll.sun.set(1, { id: 1, name: 'John Doe' });

      const result = await coll.sun.get(1);
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

      await coll.sun.set(1, {
        id: 1,
        name: 'John Doe',
        email: 'foo@bar.com',
      });

      const result = await coll.sun.get(1);
      expect(result).toEqual({
        id: 1,
        name: 'JOHN DOE',
        email: 'foo@bar.com',
        lastUpdated: 'filtered',
      });
    });
  });

  describe('Special Actions', () => {
    beforeEach(async () => {
      // Set up initial data
      await coll.sun.set(1, { id: 1, name: 'John Doe', age: 30 });
      await coll.sun.set(2, { id: 2, name: 'Jane Smith', age: 25 });
      await coll.sun.set(3, {
        id: 3,
        name: 'Bob Johnson',
        age: 40,
        status: 'locked',
      });
    });

    describe('DELETE action', () => {
      it('should delete a record when returning DELETE action with key', async () => {
        // Mutate with DELETE action
        const result = await coll.sun.mutate(1, (draft) => {
          return { action: MUTATION_ACTIONS.DELETE, key: 1 };
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(await coll.sun.has(1)).toBe(false);
      });

      it('should delete a record using the ID from the draft', async () => {
        // Mutate with DELETE action using ID from draft
        const result = await coll.sun.mutate(2, (draft) => {
          if (draft) {
            return { action: MUTATION_ACTIONS.DELETE, key: draft.id };
          }
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(await coll.sun.has(2)).toBe(false);
      });

      it("should  delete a record even if action doesn't have key", async () => {
        // Mutate with DELETE action but missing key
        const result = await coll.sun.mutate(1, () => {
          return { action: MUTATION_ACTIONS.DELETE };
        });

        // Result should be undefined (as per DELETE action)
        expect(result).toBeUndefined();

        const has1 = await coll.sun.has(1);
        expect(has1).toBe(false);
      });
    });

    describe('NOOP action', () => {
      it('should do nothing when returning NOOP action', async () => {
        // Get the original record
        const original = await coll.sun.get(3);

        // Mutate with NOOP action
        const result = await coll.sun.mutate(3, (draft) => {
          if (draft && draft.status === 'locked') {
            return { action: MUTATION_ACTIONS.NOOP };
          }

          // This should not be executed due to the NOOP
          draft.name = 'Changed Name';
          return draft;
        });

        // Result should be the original record
        expect(result).toEqual(original);

        // Record should not be changed
        expect(await coll.sun.get(3)).toEqual(original);
      });
    });

    describe('Nested async mutations', () => {
      it('should handle nested async operations', async () => {
        // Mutate with nested async functions
        const result = await coll.sun.mutate(1, async (draft) => {
          if (draft) {
            // First async operation
            await new Promise((resolve) => setTimeout(resolve, 10));
            draft.name = 'First Update';

            // Second async operation
            const secondUpdate = async () => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return 'Second Update';
            };

            draft.name = await secondUpdate();

            return draft;
          }
        });

        // Check that the record was updated with the final value
        expect(result?.name).toBe('Second Update');

        // Check that the stored record was updated
        const stored = await coll.sun.get(1);
        expect(stored?.name).toBe('Second Update');
      });
    });
  });

  describe('Error handling', () => {
    describe('Asynchronous error handling', () => {
      it('should catch and rethrow errors from async mutators', async () => {
        // Define a mutator that throws an error
        const errorMutator = async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error(TEST_ERROR);
        };
        await coll.sun.set(1, { name: 'foo', email: 'foo@bar.com', id: 1 });

        // Expect the mutate call to throw
        await expect(coll.sun.mutate(1, errorMutator)).rejects.toThrow(
          new RegExp(TEST_ERROR),
        );

        // Verify that the original record is unchanged
        const record = await coll.sun.get(1);
        expect(record).toEqual({ name: 'foo', email: 'foo@bar.com', id: 1 });
      });

      it('should continue processing mutations after an error', async () => {
        await coll.sun.set(1, { name: 'foo', email: 'foo@bar.com', id: 1 });
        // First try a mutation that throws
        try {
          await coll.sun.mutate(1, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw new Error(TEST_ERROR);
          });
        } catch (error) {
          // Ignore the error
        }

        // Then try a valid mutation
        await coll.sun.mutate(1, async (draft) => {
          if (draft) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            draft.name = 'Updated Name';
            return draft;
          }
        });

        // Verify that the second mutation worked
        const record = await coll.sun.get(1);
        expect(record?.name).toBe('Updated Name');
      });

      it('should handle errors in nested async operations', async () => {
        // Define a mutator with nested async operations that throw
        const NESTED_ERROR = 'Nested error';
        const errorMutator = async (draft: any) => {
          if (draft) {
            // First async operation
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Second async operation that throws
            const nestedOperation = async () => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              throw new Error(NESTED_ERROR);
            };

            await nestedOperation();

            // This should not be executed
            draft.name = 'Updated Name';
          }
          return draft;
        };

        await coll.sun.set(1, { name: 'John Doe', email: 'foo@bar.com', id: 1 });
        // Expect the mutate call to throw
        await expect(coll.sun.mutate(1, errorMutator)).rejects.toThrow(
          new RegExp(NESTED_ERROR),
        );

        // Verify that the original record is unchanged
        const record = await coll.sun.get(1);
        expect(record?.name).toBe('John Doe');
      });
    });
  });

  describe('values', () => {
    beforeEach(async () => {
      // Set up initial data
      await coll.sun.set(1, { id: 1, name: 'John Doe', age: 30 });
      await coll.sun.set(2, { id: 2, name: 'Jane Smith', age: 25 });
      await coll.sun.set(3, { id: 3, name: 'Bob Johnson', age: 40 });
    });

    it('should yield [key, value] pairs for all records', async () => {
      const values = [];
      for await (const [key, value] of coll.sun.values()) {
        values.push([key, value]);
      }
      expect(values).toHaveLength(3);
      expect(values).toEqual([
        [1, { id: 1, name: 'John Doe', age: 30 }],
        [2, { id: 2, name: 'Jane Smith', age: 25 }],
        [3, { id: 3, name: 'Bob Johnson', age: 40 }],
      ]);
    });

    it('should yield empty array when no records exist', async () => {
      await coll.sun.clear();
      const values = [];
      for await (const [key, value] of coll.sun.values()) {
        values.push([key, value]);
      }
      expect(values).toHaveLength(0);
    });
  });

  describe('find', () => {
    beforeEach(async () => {
      // Set up initial data
      await coll.sun.set(1, { id: 1, name: 'John Doe', age: 30 });
      await coll.sun.set(2, { id: 2, name: 'Jane Smith', age: 25 });
      await coll.sun.set(3, { id: 3, name: 'Bob Johnson', age: 40 });
    });

    it('should find records by field value', async () => {
      const results = [];
      for await (const [key, value] of coll.sun.find('age', 30)) {
        results.push([key, value]);
      }
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, { id: 1, name: 'John Doe', age: 30 }]);
    });

    it('should find records by predicate function', async () => {
      const results = [];
      for await (const [key, value] of coll.sun.find((record) => record.age > 30)) {
        results.push([key, value]);
      }
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([3, { id: 3, name: 'Bob Johnson', age: 40 }]);
    });

    it('should return empty array when no records match', async () => {
      const results = [];
      for await (const [key, value] of coll.sun.find('age', 50)) {
        results.push([key, value]);
      }
      expect(results).toHaveLength(0);
    });
  });
});
