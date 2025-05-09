import { beforeEach, describe, it, expect, vi } from 'vitest';
import { MemorySunF } from './MemorySunF';
import { CollSchemaLocal } from '../CollSchemaLocal';
import { FIELD_TYPES } from '../constants';
import type { CollSyncIF } from '../types.coll';
import type { DataKey } from '../type.schema';
import type { UniverseName } from '../types.multiverse';

type User = {
  id: number;
  name: string;
};

describe('MemorySunF', () => {
  let sun: MemorySunF<User, number>;
  let coll: CollSyncIF<User>;
  beforeEach(() => {
    coll = {
      isAsync: false,
      send(key: DataKey, target: UniverseName): void {},
      get(key: number): any {},
      has(key: KeyType | DataKey): boolean {
        return false;
      },
      set(key: number, value: User): void {},
      name: 'users',
      schema: new CollSchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
        name: { type: FIELD_TYPES.string, universalName: 'username' },
      }),
    };

    sun = new MemorySunF<User, number>(coll);
  });
  describe('get/set', () => {
    it('should return nothing if key is not found', () => {
      const result = sun.get(1);
      expect(result).toBeUndefined();
    });
    it('should return nothing if key is not found', () => {
      const mockUser = { id: 1, name: 'John Doe' };
      sun.set(mockUser.id, mockUser);
      const result = sun.get(1);
      expect(result).toEqual(mockUser);
    });
  });

  describe('hss', () => {
    it('should return false if key is not found', () => {
      const result = sun.has(1);
      expect(result).toBe(false);
    });
    it('should return true if key is found', () => {
      const mockUser = { id: 1, name: 'John Doe' };
      sun.set(mockUser.id, mockUser);
      const result = sun.has(1);
      expect(result).toBe(true);
    });
  });
});
