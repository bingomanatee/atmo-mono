import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIELD_TYPES, MUTATION_ACTIONS } from '../constants';
import { Multiverse } from '../Multiverse';
import { SchemaLocal } from '../SchemaLocal';
import { SchemaUniversal } from '../SchemaUniversal';
import { memoryImmerAsyncSunF } from '../suns/SunMemoryImmerAsync';
import type { CollAsyncIF } from '../types.coll';
import type { UniverseIF } from '../types.multiverse';
import { Universe } from '../Universe';
import { CollAsync } from './CollAsync';

const TEST_ERROR = 'Test Error';
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

describe('CollAsync', () => {
  describe('*class', () => {
    it('has its given name', async () => {
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
      const c: CollAsyncIF = new CollAsync({
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
      it('should return undefined if the key does not exist', async () => {
        const m = new Multiverse();
        const u = new Universe('default');
        m.add(u);
        const c = new CollAsync<User, number>(collDef(u));

        expect(await c.has(1)).toBeFalsy();
      });

      it('should return the value if the key exists', async () => {
        const m = new Multiverse();
        const u = new Universe('default');
        m.add(u);
        const c = new CollAsync<User, number>(collDef(u));
        await c.set(1, { id: 1, name: 'foo', zip_code: 12345 });
        expect(await c.has(1)).toBeTruthy();
      });
    });

    describe('set', () => {
      it('should store a value', async () => {
        const m = new Multiverse();
        const u = new Universe('default');
        m.add(u);
        const c = new CollAsync<User, number>(collDef(u));

        const user = { id: 1, name: 'foo', zip_code: 12345 };
        await c.set(1, user);

        const retrieved = await c.get(1);
        expect(retrieved).toEqual(user);
      });
    });

    describe('send', () => {
      it('should throw an error if multiverse is not set', async () => {
        const u = new Universe('default');
        const c = new CollAsync<User, number>(collDef(u));

        await c.set(1, { id: 1, name: 'foo', zip_code: 12345 });

        await expect(c.send(1, 'target')).rejects.toThrow(/multiverse not set/);
      });

      it('should call transport on the multiverse', async () => {
        const m = new Multiverse();
        const u = new Universe('default', m);
        const c = new CollAsync<User, number>(collDef(u));

        // Mock the transport method
        const originalTransport = m.transport;
        m.transport = vi.fn().mockResolvedValue(undefined);

        await c.set(1, { id: 1, name: 'foo', zip_code: 12345 });
        await c.send(1, 'target');

        expect(m.transport).toHaveBeenCalledWith(
          1,
          'users',
          'default',
          'target',
        );

        // Restore original method
        m.transport = originalTransport;
      });
    });
  });

  describe('utility methods', () => {
    let u: Universe;
    let c: CollAsync<User, number>;

    beforeEach(async () => {
      u = new Universe('default');
      c = new CollAsync<User, number>(collDef(u));

      // Set up initial data
      await c.set(1, { id: 1, name: 'John Doe', zip_code: 12345 });
      await c.set(2, { id: 2, name: 'Jane Smith', zip_code: 23456 });
      await c.set(3, { id: 3, name: 'Bob Johnson', zip_code: 34567 });
      await c.set(4, { id: 4, name: 'Alice Brown', zip_code: 45678 });
    });

    describe('each', () => {
      it('should iterate over each record', async () => {
        const records: User[] = [];
        const keys: number[] = [];

        await c.each((record, key) => {
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
      it('should return the correct count', async () => {
        expect(await c.count()).toBe(4);
      });
    });

    describe('map', () => {
      it('should map over records', async () => {
        // Reset zip codes to initial values
        await c.set(1, { id: 1, name: 'John Doe', zip_code: 12345 });
        await c.set(2, { id: 2, name: 'Jane Smith', zip_code: 23456 });
        await c.set(3, { id: 3, name: 'Bob Johnson', zip_code: 34567 });
        await c.set(4, { id: 4, name: 'Alice Brown', zip_code: 45678 });

        const result = await c.map((record) => {
          record.zip_code += 1;
          return record;
        });

        expect(result.get(1)?.zip_code).toBe(12346);
        expect(result.get(2)?.zip_code).toBe(23457);
        expect(result.get(3)?.zip_code).toBe(34568);
        expect(result.get(4)?.zip_code).toBe(45679);
      });

      it('should handle errors in map()', async () => {
        await expect(async () => {
          const result = await c.map((record, key) => {
            if (key === 3) {
              throw new Error(TEST_ERROR);
            }
            record.zip_code += 1;
            return record;
          });
          console.log('result of erroring map:', result);
        }).rejects.toThrow(new RegExp(TEST_ERROR));
      });

      it('should handle async mapper functions', async () => {
        const result = await c.map(async (record) => {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 10));
          record.zip_code += 1;
          return record;
        });

        expect(result.get(1).zip_code).toBe(12346);
        expect(result.get(2).zip_code).toBe(23457);
        expect(result.get(3).zip_code).toBe(34568);
        expect(result.get(4).zip_code).toBe(45679);
      });
    });
  });

  describe('find', () => {
    let univ: Universe;
    let schema: SchemaLocal;
    let coll: CollAsync<any, string>;

    beforeEach(async () => {
      univ = new Universe('test-universe');
      schema = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        age: { type: FIELD_TYPES.number, meta: { optional: true } },
        status: { type: FIELD_TYPES.string, meta: { optional: true } },
      });
      coll = new CollAsync({
        name: 'users',
        schema,
        universe: univ,
      });

      // Set up initial data
      await coll.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
      await coll.set('user2', { id: 'user2', name: 'Jane Smith', age: 25 });
      await coll.set('user3', {
        id: 'user3',
        name: 'Bob Johnson',
        age: 40,
        status: 'active',
      });
      await coll.set('user4', {
        id: 'user4',
        name: 'Alice Brown',
        age: 35,
        status: 'active',
      });
    });

    it('should throw an error if find is not implemented', () => {
      // Create a mock sun without find method
      const mockSun = {
        get: vi.fn(),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        // No find method
      };

      // Create a collection with the mock sun
      const coll = new CollAsync({
        name: 'mock-users',
        schema,
        universe: univ,
        sunF: () => mockSun,
      });

      // Expect find to throw an error
      expect(() => coll.find({})).toThrow(/Find method not/);
    });

    it('should find records by parameter query', async () => {
      const generator = coll.find('status', 'active');
      let results = new Map();
      let data = generator.next();
      while (!data.done) {
        const [key, value] = data.value;
        results.set(key, value);
        data = generator.next();
      }

      // Should return 2 users
      expect(results.size).toBe(2);
      expect(
        Array.from(results.values())
          .map((user) => user.id)
          .sort(),
      ).toEqual(['user3', 'user4'].sort());
    });

    it('should find records by function predicate', async () => {
      // Find users over 30
      const generator = coll.find((user) => user.age > 30);
      let results = new Map();
      let data = generator.next();
      while (!data.done) {
        const [key, value] = data.value;
        results.set(key, value);
        data = generator.next();
      }

      // Should return 2 users
      expect(results.size).toBe(2);
      expect(
        Array.from(results.values())
          .map((user) => user.id)
          .sort(),
      ).toEqual(['user3', 'user4'].sort());
    });

    it('should return empty map if no records match', async () => {
      // Find users with non-existent status
      const generator = await coll.find('status', 'inactive');
      let results = new Map();
      let data = generator.next();
      while (!data.done) {
        const [key, value] = data.value;
        results.set(key, value);
        data = generator.next();
      }
      // Should return empty map
      expect(results.size).toBe(0);
    });
  });

  describe('mutate with special actions', () => {
    let univ: Universe;
    let schema: SchemaLocal;
    let coll: CollAsync<any, string>;

    beforeEach(async () => {
      univ = new Universe('test-universe');
      schema = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string },
        age: { type: FIELD_TYPES.number, meta: { optional: true } },
        status: { type: FIELD_TYPES.string, meta: { optional: true } },
      });
      coll = new CollAsync({
        name: 'users',
        schema,
        universe: univ,
        sunF: memoryImmerAsyncSunF,
      });

      // Set up initial data
      await coll.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
      await coll.set('user2', { id: 'user2', name: 'Jane Smith', age: 25 });
      await coll.set('user3', {
        id: 'user3',
        name: 'Bob Johnson',
        age: 40,
        status: 'locked',
      });
    });

    describe('DELETE action', () => {
      it('should delete a record when returning DELETE action with key', async () => {
        // Mutate with DELETE action
        const result = await coll.mutate('user1', () => {
          return { action: MUTATION_ACTIONS.DELETE, key: 'user1' };
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(await coll.has('user1')).toBe(false);
      });

      it('should delete a record using the ID from the draft', async () => {
        // Mutate with DELETE action using ID from draft
        const result = await coll.mutate('user2', (draft) => {
          if (draft) {
            return { action: MUTATION_ACTIONS.DELETE, key: draft.id };
          }
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(await coll.has('user2')).toBe(false);
      });
    });

    describe('NOOP action', () => {
      it('should do nothing when returning NOOP action', async () => {
        // Get the original record
        const original = await coll.get('user3');

        // Mutate with NOOP action
        const result = await coll.mutate('user3', (draft) => {
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
        expect(await coll.get('user3')).toEqual(original);
      });
    });

    describe('Nested async mutations', () => {
      it('should handle nested async operations', async () => {
        // Mutate with nested async functions
        const result = await coll.mutate('user1', async (draft) => {
          if (draft) {
            // First async operation
            await delayMs(10);
            draft.name = 'First Update';

            // Second async operation
            const secondUpdate = async () => {
              await delayMs(10);
              return 'Second Update';
            };

            draft.name = await secondUpdate();

            return draft;
          }
        });

        // Check that the record was updated with the final value
        expect(result?.name).toBe('Second Update');

        // Check that the stored record was updated
        const stored = await coll.get('user1');
        expect(stored?.name).toBe('Second Update');
      });
    });

    describe('Collection access', () => {
      it('should provide access to the collection in the mutator function', async () => {
        // Mutate with a function that uses the collection
        const result = await coll.mutate('user1', async (draft, collection) => {
          if (draft) {
            // Get another record from the collection
            const user2 = await collection.get('user2');

            // Update the draft based on the other record
            draft.name = `Friend of ${user2?.name}`;
            return draft;
          }
        });

        // Check that the record was updated using data from the collection
        expect(result?.name).toBe('Friend of Jane Smith');

        // Check that the stored record was updated
        const stored = await coll.get('user1');
        expect(stored?.name).toBe('Friend of Jane Smith');
      });
    });

    describe('Error handling', () => {
      it('should handle errors in async mutations', async () => {
        // Attempt to mutate with a function that throws an error

        await expect(async () => {
          await coll.mutate('user1', async (draft) => {
            if (draft) {
              await delayMs(10);
              throw new Error(TEST_ERROR);
            }
          });
        }).rejects.toThrow(new RegExp(TEST_ERROR));

        // Record should not be changed
        const user = await coll.get('user1');
        expect(user?.name).toBe('John Doe');
      });
    });
  });
});
