import { beforeEach, describe, expect, it, afterEach, vi } from 'vitest';
import { SunMemoryAsync } from './SunMemoryAsync.ts';
import { FIELD_TYPES, MUTATION_ACTIONS } from '../constants';
import type { CollAsyncIF } from '../types.coll';
import { SchemaLocal } from '../SchemaLocal';
import { CollAsync } from '../collections/CollAsync.ts';
import { Universe } from '../Universe';
import type { PostParams } from '../type.schema';

type User = { id: number; name: string; age?: number; email?: string };
const TEST_ERROR = 'Test Error';
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
      sunF(coll) {
        sun = new SunMemoryAsync<User, number>(coll);
        return sun;
      },
    });
  });

  describe('constructor', () => {
    it('should create a new instance with an empty data map', async () => {
      expect(sun).toBeInstanceOf(SunMemoryAsync);
      expect(await sun.has(1)).toBe(false);
    });
  });

  describe('basic operations', () => {
    describe('get', () => {
      it('should return undefined for missing records', async () => {
        const result = await sun.get(1);
        expect(result).toBeUndefined();
      });

      it('should return the record if it exists', async () => {
        const user = { id: 1, name: 'John Doe' };
        await sun.set(1, user);
        expect(await sun.get(1)).toEqual(user);
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
      expect(await sun.get(1)).toEqual(user);
    });

    it('should update an existing record', async () => {
      await sun.set(1, { id: 1, name: 'John Doe' });
      await sun.set(1, { id: 1, name: 'John Updated' });

      expect(await sun.get(1)).toEqual({ id: 1, name: 'John Updated' });
    });

    it('should validate field types for id', async () => {
      await expect(async () => {
        await sun.set(1, { id: 'not a number', name: 'John Doe' });
      }).rejects.toThrow(/validation.*id/);
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
        sunF(coll) {
          sun = new SunMemoryAsync<User, number>(coll);
          return sun;
        },
      });
    });

    it('should apply field filters when setting a record', async () => {
      await sun.set(1, { id: 1, name: 'John Doe', email: 'JOHN@EXAMPLE.COM' });

      const result = await sun.get(1);
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

      const result = await sun.get(1);

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
          sun = new SunMemoryAsync<User & { lastUpdated?: string }, number>(
            coll,
          );
          return sun;
        },
      });
    });

    it('should apply record filter when setting a record', async () => {
      await sun.set(1, { id: 1, name: 'John Doe' });

      const result = await sun.get(1);
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

      const newRecord = await sun.set(1, {
        id: 1,
        name: 'John Doe',
        email: 'foo@bar.com',
      });

      const result = await sun.get(1);
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
      await sun.set(1, { id: 1, name: 'John Doe', age: 30 });
      await sun.set(2, { id: 2, name: 'Jane Smith', age: 25 });
      await sun.set(3, {
        id: 3,
        name: 'Bob Johnson',
        age: 40,
        status: 'locked',
      });
    });

    describe('DELETE action', () => {
      it('should delete a record when returning DELETE action with key', async () => {
        // Mutate with DELETE action
        const result = await sun.mutate(1, (draft) => {
          return { action: MUTATION_ACTIONS.DELETE, key: 1 };
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(await sun.has(1)).toBe(false);
      });

      it('should delete a record using the ID from the draft', async () => {
        // Mutate with DELETE action using ID from draft
        const result = await sun.mutate(2, (draft) => {
          if (draft) {
            return { action: MUTATION_ACTIONS.DELETE, key: draft.id };
          }
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(await sun.has(2)).toBe(false);
      });

      it("should  delete a record even if action doesn't have key", async () => {
        // Mutate with DELETE action but missing key
        const result = await sun.mutate(1, () => {
          return { action: MUTATION_ACTIONS.DELETE };
        });

        // Result should be undefined (as per DELETE action)
        expect(result).toBeUndefined();

        const has1 = await sun.has(1);
        expect(has1).toBe(false);
      });
    });

    describe('NOOP action', () => {
      it('should do nothing when returning NOOP action', async () => {
        // Get the original record
        const original = await sun.get(3);

        // Mutate with NOOP action
        const result = await sun.mutate(3, (draft) => {
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
        expect(await sun.get(3)).toEqual(original);
      });
    });

    describe('Nested async mutations', () => {
      it('should handle nested async operations', async () => {
        // Mutate with nested async functions
        const result = await sun.mutate(1, async (draft) => {
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
        const stored = await sun.get(1);
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
        await sun.set(1, { name: 'foo', email: 'foo@bar.com', id: 1 });

        // Expect the mutate call to throw
        await expect(sun.mutate(1, errorMutator)).rejects.toThrow(
          new RegExp(TEST_ERROR),
        );

        // Verify that the original record is unchanged
        const record = await sun.get(1);
        expect(record).toEqual({ name: 'foo', email: 'foo@bar.com', id: 1 });
      });

      it('should continue processing mutations after an error', async () => {
        await sun.set(1, { name: 'foo', email: 'foo@bar.com', id: 1 });
        // First try a mutation that throws
        try {
          await sun.mutate(1, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw new Error(TEST_ERROR);
          });
        } catch (error) {
          // Ignore the error
        }

        // Then try a valid mutation
        await sun.mutate(1, async (draft) => {
          if (draft) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            draft.name = 'Updated Name';
            return draft;
          }
        });

        // Verify that the second mutation worked
        const record = await sun.get(1);
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

        await sun.set(1, { name: 'John Doe', email: 'foo@bar.com', id: 1 });
        // Expect the mutate call to throw
        await expect(sun.mutate(1, errorMutator)).rejects.toThrow(
          new RegExp(NESTED_ERROR),
        );

        // Verify that the original record is unchanged
        const record = await sun.get(1);
        expect(record?.name).toBe('John Doe');
      });
    });
  });
});
