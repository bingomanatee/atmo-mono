import { describe, expect, it, vi } from 'vitest';
import { Multiverse } from './Multiverse';
import { CollAsync } from './CollAsync';
import { Universe } from './Universe';
import { FIELD_TYPES } from './constants';
import type { CollAsyncIF } from './types.coll';
import type { UniverseIF } from './types.multiverse';
import { SchemaUniversal } from './SchemaUniversal.ts';

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
});
