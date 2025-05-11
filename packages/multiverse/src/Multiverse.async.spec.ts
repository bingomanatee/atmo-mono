import { beforeEach, describe, expect, it } from 'vitest';
import { Multiverse } from './Multiverse.ts';
import type { DataRecord } from './types/types.multiverse.ts';
import { FIELD_TYPES } from './constants.ts';
import { Universe } from './Universe.ts';
import { CollSync } from './collections/CollSync.ts';
import { CollAsync } from './collections/CollAsync.ts';
import { SchemaUniversal } from './SchemaUniversal.ts';
import { SchemaLocal } from './SchemaLocal.ts';

// Define a simple user type for testing
type User = {
  id: number;
  name: string;
  address: string;
};

describe('Multiverse with Async Collections', () => {
  let multiverse: Multiverse;
  let syncUniverse: Universe;
  let asyncUniverse: Universe;
  let syncUsers: CollSync<User, number>;
  let asyncUsers: CollAsync<User, number>;

  // Create a universal schema for the 'users' collection
  const universalSchema = new Map([
    [
      'users',
      new SchemaUniversal('users', {
        id: FIELD_TYPES.number,
        name: FIELD_TYPES.string,
        address: FIELD_TYPES.string,
      }),
    ],
  ]);

  beforeEach(() => {
    // Set up the multiverse with universes and collections
    multiverse = new Multiverse(universalSchema);

    // Create universes
    syncUniverse = new Universe('sync-universe', multiverse);
    asyncUniverse = new Universe('async-universe', multiverse);

    // Create collections
    syncUsers = new CollSync<User, number>({
      name: 'users',
      universe: syncUniverse,
      schema: new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
        name: { type: FIELD_TYPES.string },
        address: { type: FIELD_TYPES.string },
      }),
    });

    asyncUsers = new CollAsync<User, number>({
      name: 'users',
      universe: asyncUniverse,
      schema: new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
        name: { type: FIELD_TYPES.string },
        address: { type: FIELD_TYPES.string },
      }),
    });
  });

  describe('transport', () => {
    it('should transport from sync to async collection', async () => {
      // Set up test data
      const user = { id: 1, name: 'John Doe', address: '123 Main St' };
      syncUsers.set(1, user);

      // Transport from sync to async
      await multiverse.transport(
        1,
        'users',
        syncUniverse.name,
        asyncUniverse.name,
      );

      // Verify the record was transported
      const asyncResult = await asyncUsers.get(1);
      expect(asyncResult).toEqual(user);
    });

    it('should transport from async to sync collection', async () => {
      // Set up test data
      const user = { id: 1, name: 'Jane Smith', address: '456 Oak Ave' };
      await asyncUsers.set(1, user);

      // Transport from async to sync
      // This will fail if transport doesn't properly handle async collections
      await multiverse.transport(
        1,
        'users',
        asyncUniverse.name,
        syncUniverse.name,
      );

      // Verify the record was transported
      const syncResult = syncUsers.get(1);
      expect(syncResult).toEqual(user);
    });

    it('should transport from async to async collection', async () => {
      // Create another async universe and collection
      const anotherAsyncUniverse = new Universe('another-async', multiverse);
      const anotherAsyncUsers = new CollAsync<User, number>({
        name: 'users',
        universe: anotherAsyncUniverse,
        schema: new SchemaLocal('users', {
          id: { type: FIELD_TYPES.number },
          name: { type: FIELD_TYPES.string },
          address: { type: FIELD_TYPES.string },
        }),
      });

      // Set up test data
      const user = { id: 1, name: 'Bob Johnson', address: '789 Pine St' };
      await asyncUsers.set(1, user);

      // Transport from async to async
      await multiverse.transport(
        1,
        'users',
        asyncUniverse.name,
        anotherAsyncUniverse.name,
      );

      // Verify the record was transported
      const result = await anotherAsyncUsers.get(1);
      expect(result).toEqual(user);
    });
  });
});
