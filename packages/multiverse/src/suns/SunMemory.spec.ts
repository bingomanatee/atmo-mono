import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollSync } from '../collections/CollSync';
import { FIELD_TYPES, MUTATION_ACTIONS } from '../constants';
import { SchemaLocal } from '../SchemaLocal';
import type { PostParams } from '../type.schema';
import type { CollSyncIF } from '../types.coll';
import { Universe } from '../Universe';
import sunF, { SunMemory } from './SunMemory';

type User = { id: number; name: string; age?: number; email?: string };

describe('SunMemory', () => {
  let univ: Universe;
  let schema: SchemaLocal;
  let coll: CollSyncIF<User, number>;
  let sun: SunMemory<User, number>;

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
      sunF: sunF,
    });
    sun = coll.sun;
  });

  describe('constructor', () => {
    it('should create a new instance with an empty data map', () => {
      expect(sun).toBeInstanceOf(SunMemory);
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

    it.skip('should validate field types', () => {
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

    it.skip('should validate optional fields when provided', () => {
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

      sun = new SunMemory<User, number>({ coll });
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

      sun = new SunMemory<User & { lastUpdated?: string }, number>({ coll });
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

  describe('Special Actions', () => {
    beforeEach(() => {
      // Set up initial data
      sun.set(1, { id: 1, name: 'John Doe', age: 30 });
      sun.set(2, { id: 2, name: 'Jane Smith', age: 25 });
      sun.set(3, { id: 3, name: 'Bob Johnson', age: 40, status: 'locked' });
    });

    describe('DELETE action', () => {
      it('should delete a record when returning DELETE action with key', () => {
        // Mutate with DELETE action
        const result = sun.mutate(1, () => {
          return { action: MUTATION_ACTIONS.DELETE, key: 1 };
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(sun.has(1)).toBe(false);
      });

      it('should delete a record using the ID from the draft', () => {
        // Mutate with DELETE action using ID from draft
        const result = sun.mutate(2, (draft) => {
          if (draft) {
            return { action: MUTATION_ACTIONS.DELETE, key: draft.id };
          }
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(sun.has(2)).toBe(false);
      });
    });

    describe('NOOP action', () => {
      it('should do nothing when returning NOOP action', () => {
        // Get the original record
        const original = sun.get(3);

        // Mutate with NOOP action
        const result = sun.mutate(3, (draft) => {
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
        expect(sun.get(3)).toEqual(original);
      });
    });

    describe('Collection locking', () => {
      it('should throw on set operations during mutation', () => {
        expect(() =>
          sun.mutate(1, (draft, collection) => {
            if (draft) {
              // Try to set another record during mutation
              collection.set(4, { id: 4, name: 'New User', age: 22 });
              // Update the draft
              draft.name = 'Updated Name';
            }
            return draft;
          }),
        ).toThrow();
        expect(sun.has(4)).toBeFalsy();
      });

      it('should throw on delete operations during mutation', () => {
        expect(() => {
          sun.mutate(1, (draft, collection) => {
            collection.delete(2);
            if (draft) {
              // Try to delete another record during mutation

              // Update the draft
              draft.name = 'Updated Name';
              return draft;
            }
          });
        }).toThrow();

        // Check that the original record was updated
        expect(sun.get(1)?.name).toBe('John Doe');

        // Check that the other record was deleted (after the mutation completed)
        expect(sun.has(2)).toBe(true);
      });
    });
  });

  describe('Error handling', () => {
    let consoleSpy: any;

    beforeEach(() => {
      // Set up initial data
      sun.set(1, { id: 1, name: 'John Doe', age: 30 });

      // Spy on console.error
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy?.mockRestore();
    });

    describe('Synchronous error handling', () => {
      it('should catch and rethrow errors from synchronous mutators', () => {
        // Define a mutator that throws an error
        const errorMutator = () => {
          throw new Error('Test error in sync mutator');
        };

        // Expect the mutate call to throw
        expect(() => sun.mutate(1, errorMutator)).toThrow(
          'Test error in sync mutator',
        );

        // Verify that the original record is unchanged
        expect(sun.get(1)).toEqual({
          id: 1,
          name: 'John Doe',
          age: 30,
        });
      });

      it('should continue processing mutations after an error', async () => {
        // First try a mutation that throws
        try {
          sun.mutate(1, () => {
            throw new Error('Test error');
          });
        } catch (error) {
          // Ignore the error
        }

        // Then try a valid mutation
        sun.mutate(1, (draft) => {
          if (draft) {
            draft.name = 'Updated Name';
            return draft;
          }
        });

        // Wait for the event queue to be processed
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Verify that the second mutation worked
        expect(sun.get(1)?.name).toBe('Updated Name');
      });
    });
  });

  describe('values', () => {
    beforeEach(() => {
      // Set up initial data
      sun.set(1, { id: 1, name: 'John Doe', age: 30 });
      sun.set(2, { id: 2, name: 'Jane Smith', age: 25 });
      sun.set(3, { id: 3, name: 'Bob Johnson', age: 40 });
    });

    it('should yield [key, value] pairs for all records', () => {
      const values = Array.from(sun.values());
      expect(values).toHaveLength(3);
      expect(values).toEqual([
        [1, { id: 1, name: 'John Doe', age: 30 }],
        [2, { id: 2, name: 'Jane Smith', age: 25 }],
        [3, { id: 3, name: 'Bob Johnson', age: 40 }],
      ]);
    });

    it('should yield empty array when no records exist', () => {
      sun.clear();
      const values = Array.from(sun.values());
      expect(values).toHaveLength(0);
    });
  });

  describe('find', () => {
    beforeEach(() => {
      // Set up initial data
      sun.set(1, { id: 1, name: 'John Doe', age: 30 });
      sun.set(2, { id: 2, name: 'Jane Smith', age: 25 });
      sun.set(3, { id: 3, name: 'Bob Johnson', age: 40 });
    });

    it('should find records by field value', () => {
      const results = Array.from(sun.find('age', 30));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, { id: 1, name: 'John Doe', age: 30 }]);
    });

    it('should find records by predicate function', () => {
      const results = Array.from(sun.find((record) => record.age > 30));
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([3, { id: 3, name: 'Bob Johnson', age: 40 }]);
    });

    it('should return empty array when no records match', () => {
      const results = Array.from(sun.find('age', 50));
      expect(results).toHaveLength(0);
    });
  });
});
