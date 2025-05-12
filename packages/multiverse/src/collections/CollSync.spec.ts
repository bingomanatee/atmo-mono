import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Multiverse } from '../Multiverse.ts';
import { CollSync } from './CollSync.ts';
import { Universe } from '../Universe.ts';
import { FIELD_TYPES, MUTATION_ACTIONS } from '../constants.ts';
import type { CollSyncIF } from '../types.coll.ts';
import type { UniverseIF } from '../types.multiverse.ts';
import { SchemaUniversal } from '../SchemaUniversal.ts';
import { SchemaLocal } from '../SchemaLocal.ts';
import memoryImmerSunF from '../suns/SunMemoryImmer.ts';

// Helper function for tests
const delayMs = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type User = { id: number; name: string; zip_code: number };

const collDef = (u: UniverseIF) => ({
  universe: u,
  name: 'users',
  schema: {
    fields: {
      id: { type: FIELD_TYPES.number, unique: true },
      name: FIELD_TYPES.string,
      zip_code: FIELD_TYPES.number,
    },
  },
});
const TEST_ERROR = 'Test Error';
describe('CollSync', () => {
  describe('*class', () => {
    it('has its given name', () => {
      const m = new Multiverse(
        new Map([
          [
            'foo',
            new SchemaUniversal<User>('foo', {
              id: FIELD_TYPES.number,
              name: FIELD_TYPES.string,
              zip_code: FIELD_TYPES.string,
            }),
          ],
        ]),
      );
      const u = new Universe('default');
      const c: CollSyncIF = new CollSync({
        name: 'foo',
        universe: u,
        schema: {
          fields: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
      });
      u.add(c);
      m.add(u);

      expect(c.name).toBe('foo');
    });
  });

  describe('i/o', () => {
    describe('get', () => {
      it('should return undefined if the key does not exist', () => {
        const m = new Multiverse();
        const u = new Universe('default');
        m.add(u);
        const c = new CollSync<User, number>(collDef(u));
        expect(c.get(1)).toBeUndefined();
      });

      it('should return the value if the key exists', () => {
        const m = new Multiverse();
        const u = new Universe('default');
        m.add(u);
        const c = new CollSync<User, number>(collDef(u));
        c.set(1, { id: 1, name: 'foo', zip_code: 12345 });
        expect(c.has(1)).toBeTruthy();
      });
    });
  });

  describe('utility methods', () => {
    let u: Universe;
    let c: CollSync<User, number>;

    beforeEach(() => {
      u = new Universe('default');
      c = new CollSync<User, number>(collDef(u));

      // Set up initial data
      c.set(1, { id: 1, name: 'John Doe', zip_code: 12345 });
      c.set(2, { id: 2, name: 'Jane Smith', zip_code: 23456 });
      c.set(3, { id: 3, name: 'Bob Johnson', zip_code: 34567 });
      c.set(4, { id: 4, name: 'Alice Brown', zip_code: 45678 });
    });

    describe('each', () => {
      it('should iterate over each record', () => {
        const records: User[] = [];
        const keys: number[] = [];

        c.each((record, key) => {
          records.push(record);
          keys.push(key);
        });

        expect(records.length).toBe(4);
        expect(keys).toContain(1);
        expect(keys).toContain(2);
        expect(keys).toContain(3);
        expect(keys).toContain(4);
      });
    });

    describe('count', () => {
      it('should return the correct count', () => {
        expect(c.count()).toBe(4);
      });
    });

    describe('map', () => {
      it('should map over records', () => {
        // Reset zip codes to initial values
        c.set(1, { id: 1, name: 'John Doe', zip_code: 12345 });
        c.set(2, { id: 2, name: 'Jane Smith', zip_code: 23456 });
        c.set(3, { id: 3, name: 'Bob Johnson', zip_code: 34567 });
        c.set(4, { id: 4, name: 'Alice Brown', zip_code: 45678 });

        const newValues: Map<number, User> = c.map((record) => {
          return { ...record, zip_code: record.zip_code + 1 };
        });

        expect(newValues.size).toBe(4);
        // Manually update the records since the map function doesn't modify them in-place
        expect(newValues.get(1).zip_code).toBe(12346);
        expect(newValues.get(2).zip_code).toBe(23457);
        expect(newValues.get(3).zip_code).toBe(34568);
        expect(newValues.get(4).zip_code).toBe(45679);
      });

      it('should handle errors in map()', () => {
        // Reset zip codes to initial values
        c.set(1, { id: 1, name: 'John Doe', zip_code: 12345 });
        c.set(2, { id: 2, name: 'Jane Smith', zip_code: 23456 });
        c.set(3, { id: 3, name: 'Bob Johnson', zip_code: 34567 });
        c.set(4, { id: 4, name: 'Alice Brown', zip_code: 45678 });

        expect(() => {
          c.map((record, key) => {
            if (key === 3) {
              throw new Error(TEST_ERROR);
            }
            record.zip_code += 1;
            return record;
          }, true);
        }).toThrow(new RegExp(TEST_ERROR));
      });
    });
  });

  describe('find', () => {
    let univ: Universe;
    let schema: SchemaLocal;
    let coll: CollSync<any, string>;

    beforeEach(() => {
      univ = new Universe('test-universe');
      schema = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        age: { type: FIELD_TYPES.number, meta: { optional: true } },
        status: { type: FIELD_TYPES.string, meta: { optional: true } },
      });
      coll = new CollSync({
        name: 'users',
        schema,
        universe: univ,
      });

      // Set up initial data
      coll.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
      coll.set('user2', { id: 'user2', name: 'Jane Smith', age: 25 });
      coll.set('user3', {
        id: 'user3',
        name: 'Bob Johnson',
        age: 40,
        status: 'active',
      });
      coll.set('user4', {
        id: 'user4',
        name: 'Alice Brown',
        age: 35,
        status: 'active',
      });
    });

    it('should throw an error if find is not implemented', () => {
      // Create a mock engine without find method
      const mockEngine = {
        get: vi.fn(),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        // No find method
      };

      // Create a collection with the mock engine
      const mockColl = new CollSync({
        name: 'mock-users',
        schema,
        universe: univ,
        sunF: () => mockEngine,
      });

      // Expect find to throw an error
      expect(() => mockColl.find({})).toThrow('Find method not implemented');
    });

    it('should find records by object query', () => {
      // Find users with status 'active'
      const results = coll.find('status', 'active');

      // Should return 2 users
      expect(results.size).toBe(2);
      expect(
        Array.from(results.values())
          .map((user) => user.id)
          .sort(),
      ).toEqual(['user3', 'user4'].sort());
    });

    it('should find records by function predicate', () => {
      // Find users over 30
      const results = coll.find(
        (user) => user.age !== undefined && user.age > 30,
      );

      // Should return 2 users
      expect(results.size).toBe(2);
      expect(
        Array.from(results.values())
          .map((user) => user.id)
          .sort(),
      ).toEqual(['user3', 'user4'].sort());
    });

    it('should find records with multiple criteria', () => {
      // Find active users over 35
      const results = coll.find((user) => {
        return (
          user.status === 'active' && user.age !== undefined && user.age >= 35
        );
      });
      // Should return 1 user
      expect(results.size).toBe(2);
      expect(
        Array.from(results.values())
          .map((u) => u.id)
          .sort(),
      ).toEqual(['user3', 'user4']);
    });

    it('should return empty array if no records match', () => {
      // Find users with non-existent status
      const results = coll.find({ status: 'inactive' });

      // Should return empty array
      expect(results).toEqual(new Map());
    });
  });

  describe('mutate with special actions', () => {
    describe('with Immer Sun', () => {
      let univ: Universe;
      let schema: SchemaLocal;
      let coll: CollSync<any, string>;

      beforeEach(() => {
        univ = new Universe('test-universe');
        schema = new SchemaLocal('users', {
          id: { type: FIELD_TYPES.string },
          name: { type: FIELD_TYPES.string },
          age: { type: FIELD_TYPES.number, meta: { optional: true } },
          status: { type: FIELD_TYPES.string, meta: { optional: true } },
        });
        coll = new CollSync({
          name: 'users',
          schema,
          universe: univ,
          sunF: memoryImmerSunF,
        });

        // Set up initial data
        coll.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
        coll.set('user2', { id: 'user2', name: 'Jane Smith', age: 25 });
        coll.set('user3', {
          id: 'user3',
          name: 'Bob Johnson',
          age: 40,
          status: 'locked',
        });
      });

      describe('DELETE action', () => {
        it('should delete a record when returning DELETE action with key', () => {
          // Mutate with DELETE action
          const result = coll.mutate('user1', (draft) => {
            return { action: MUTATION_ACTIONS.DELETE, key: 'user1' };
          });

          // Result should be undefined
          expect(result).toBeUndefined();

          // Record should be deleted
          expect(coll.has('user1')).toBe(false);
        });

        it('should delete a record using the ID from the draft', () => {
          // Mutate with DELETE action using ID from draft
          const result = coll.mutate('user2', (draft) => {
            if (draft) {
              return { action: MUTATION_ACTIONS.DELETE, key: draft.id };
            }
          });

          // Result should be undefined
          expect(result).toBeUndefined();

          // Record should be deleted
          expect(coll.has('user2')).toBe(false);
        });
      });

      describe('NOOP action', () => {
        it('should do nothing when returning NOOP action', () => {
          // Get the original record
          const original = coll.get('user3');

          // Mutate with NOOP action
          const result = coll.mutate('user3', (draft) => {
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
          expect(coll.get('user3')).toEqual(original);
        });
      });

      describe('Collection access', () => {
        it('should provide access to the collection in the mutator function', () => {
          // Mutate with a function that uses the collection
          coll.mutate('user1', (draft, collection) => {
            if (draft) {
              // Get another record from the collection
              const user2 = collection.get('user2');

              // Update the draft based on the other record
              draft.name = `Friend of ${user2?.name}`;
              return draft;
            }
          });

          // Check that the record was updated using data from the collection
          expect(coll.get('user1')?.name).toBe('Friend of Jane Smith');
        });
      });
    });
  });

  describe('mutate', () => {
    describe('with standard memory Sun', () => {
      let univ: Universe;
      let schema: SchemaLocal;
      let coll: CollSync<any, number>;

      beforeEach(() => {
        univ = new Universe('test-universe');
        schema = new SchemaLocal('users', {
          id: { type: FIELD_TYPES.number },
          name: { type: FIELD_TYPES.string },
          age: { type: FIELD_TYPES.number, meta: { optional: true } },
          email: { type: FIELD_TYPES.string, meta: { optional: true } },
          address: {
            type: FIELD_TYPES.object,
            meta: {
              optional: true,
              fields: {
                street: { type: FIELD_TYPES.string, meta: { optional: true } },
                city: { type: FIELD_TYPES.string, meta: { optional: true } },
                zip: { type: FIELD_TYPES.number, meta: { optional: true } },
              },
            },
          },
          tags: {
            type: FIELD_TYPES.array,
            meta: {
              optional: true,
              itemType: FIELD_TYPES.string,
            },
          },
        });
        coll = new CollSync({
          name: 'users',
          schema,
          universe: univ,
        });
      });

      it('should mutate an existing record', () => {
        // Set initial record
        const user = { id: 1, name: 'John Doe' };
        coll.set(1, user);

        // Mutate the record
        const result = coll.mutate(1, (draft) => {
          if (draft) {
            draft.name = 'Jane Doe';
            draft.age = 30;
          }
          return draft;
        });

        console.log(
          'should mutate an existing record: result of mutate is ',
          result,
        );

        // Check the result
        expect(result).toEqual({ id: 1, name: 'Jane Doe', age: 30 });

        // Check that the stored record was updated
        const storedRecord = coll.get(1);
        expect(storedRecord).toEqual({ id: 1, name: 'Jane Doe', age: 30 });
      });
    });

    describe('with Immer Sun', () => {
      let univ: Universe;
      let schema: SchemaLocal;
      let coll: CollSync<any, number>;

      beforeEach(() => {
        univ = new Universe('test-universe');
        schema = new SchemaLocal('users', {
          id: { type: FIELD_TYPES.number },
          name: { type: FIELD_TYPES.string },
          age: { type: FIELD_TYPES.number, meta: { optional: true } },
          email: { type: FIELD_TYPES.string, meta: { optional: true } },
          address: {
            type: FIELD_TYPES.object,
            meta: {
              optional: true,
              fields: {
                street: { type: FIELD_TYPES.string, meta: { optional: true } },
                city: { type: FIELD_TYPES.string, meta: { optional: true } },
                zip: { type: FIELD_TYPES.number, meta: { optional: true } },
              },
            },
          },
          tags: {
            type: FIELD_TYPES.array,
            meta: {
              optional: true,
              itemType: FIELD_TYPES.string,
            },
          },
        });
        coll = new CollSync({
          name: 'users',
          schema,
          universe: univ,
          sunF: memoryImmerSunF,
        });
      });
      beforeEach(() => {
        univ = new Universe('test-universe');
        schema = new SchemaLocal('users', {
          id: { type: FIELD_TYPES.number },
          name: { type: FIELD_TYPES.string },
          age: { type: FIELD_TYPES.number, meta: { optional: true } },
          email: { type: FIELD_TYPES.string, meta: { optional: true } },
          address: {
            type: FIELD_TYPES.object,
            meta: {
              optional: true,
              fields: {
                street: { type: FIELD_TYPES.string, meta: { optional: true } },
                city: { type: FIELD_TYPES.string, meta: { optional: true } },
                zip: { type: FIELD_TYPES.number, meta: { optional: true } },
              },
            },
          },
          tags: {
            type: FIELD_TYPES.array,
            meta: {
              optional: true,
              itemType: FIELD_TYPES.string,
            },
          },
        });
        coll = new CollSync({
          name: 'users',
          schema,
          universe: univ,
          sunF: memoryImmerSunF,
        });
      });

      it('should mutate an existing record using Immer implementation', () => {
        // Mutate the record

        coll.set(1, { id: 1, name: 'John Doe' });

        const result = coll.mutate(1, (draft) => {
          if (draft) {
            draft.name = 'Jane Doe';
            draft.age = 30;
          }
          return draft;
        });

        // Check the result
        expect(result).toEqual({ id: 1, name: 'Jane Doe', age: 30 });

        // Check that the stored record was updated
        const storedRecord = coll.get(1);
        expect(storedRecord).toEqual({ id: 1, name: 'Jane Doe', age: 30 });
      });

      it('should handle nested object mutations', () => {
        // Set initial record
        const user = {
          id: 1,
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'Anytown',
          },
        };
        coll.set(1, user);

        // Mutate the record
        const result = coll.mutate(1, (draft) => {
          if (draft && draft.address) {
            draft.address.city = 'New City';
            draft.address.zip = 12345;
          }
        });

        // Check the result
        expect(result).toEqual({
          id: 1,
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'New City',
            zip: 12345,
          },
        });

        // Check that the original record was not modified
        expect(user.address.city).toBe('Anytown');
        expect('zip' in user.address).toBe(false);
      });
    });
  });
});
