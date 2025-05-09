import { describe } from 'vitest';
import { MemorySunF } from './MemorySunF';
import { FIELD_TYPES } from '../constants';
import type { CollSyncIF } from '../types.coll';
import { SchemaLocal } from '../SchemaLocal';
import { CollSync } from '../CollSync';
import { Universe } from '../Universe';

type User = { id: number; name: string };

describe('MemorySunF', () => {
  describe('get', () => {
    const univ = new Universe('test-universe');
    const schema = new SchemaLocal('users', {
      id: FIELD_TYPES.number,
      name: { type: FIELD_TYPES.string, universalName: 'username' },
    });
    const coll: CollSyncIF<User, number> = new CollSync({
      name: 'users',
      schema,
      universe: univ,
    });

    const sun = new MemorySunF<User, number>(coll);

    it('should return nothing for missing records', () => {
      const result = sun.get(1);
      expect(result).toBeUndefined();
    });
  });
});
