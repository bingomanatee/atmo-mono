import { describe, expect, it } from 'vitest';
import { Multiverse } from './Multiverse';
import { CollSync } from './CollSync';
import { Universe } from './Universe';
import { FIELD_TYPES } from './constants';
import type { CollSyncIF } from './types.coll';
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

        expect(c.has(1)).toBeFalsy();
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
});
