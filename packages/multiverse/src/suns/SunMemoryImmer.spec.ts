import { Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollSync } from '../collections/CollSync.ts';
import { FIELD_TYPES, MUTATION_ACTIONS } from '../constants';
import { SchemaLocal } from '../SchemaLocal';
import { Universe } from '../Universe';
import { SunMemoryImmer } from './SunMemoryImmer';
import { immerable } from 'immer';

interface User {
  id: number;
  name: string;
  age?: number;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    zip?: number;
  };
  tags?: string[];
}

describe('SunMemoryImmer', () => {
  let univ: Universe;
  let schema: SchemaLocal;
  let coll: CollSync<User, number>;
  let sun: SunMemoryImmer<User, number>;

  beforeEach(() => {
    univ = new Universe('test-universe');
    schema = new SchemaLocal('users', {
      id: { type: FIELD_TYPES.number },
      name: { type: FIELD_TYPES.string, universalName: 'username' },
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
      sunF(coll) {
        sun = new SunMemoryImmer<User, number>(coll);
        return sun;
      },
    });
  });

  describe('constructor', () => {
    it('should create a new instance with an empty data map', () => {
      expect(sun).toBeInstanceOf(SunMemoryImmer);
      expect(sun.has(1)).toBe(false);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      const user = { id: 1, name: 'John Doe' };
      sun.set(1, user);

      const result = sun.get(1);
      expect(result).toEqual(user);
    });
  });

  describe('mutate', () => {
    it('should mutate an existing record', () => {
      // Set initial record
      const user = { id: 1, name: 'John Doe' };
      sun.set(1, user);

      // Mutate the record
      const result = sun.mutate(1, (draft) => {
        if (draft) {
          draft.name = 'Jane Doe';
          draft.age = 30;
        }
      });

      // Check the result
      expect(result).toEqual({ id: 1, name: 'Jane Doe', age: 30 });

      // Check that the stored record was updated
      const storedRecord = sun.get(1);
      expect(storedRecord).toEqual({ id: 1, name: 'Jane Doe', age: 30 });
    });

    it('should create a new record if it does not exist', () => {
      // Mutate a non-existent record
      const result = sun.mutate(1, (draft) => {
        return { id: 1, name: 'John Doe' };
      });

      // Check the result
      expect(result).toEqual({ id: 1, name: 'John Doe' });

      // Check that the record was stored
      const storedRecord = sun.get(1);
      expect(storedRecord).toEqual({ id: 1, name: 'John Doe' });
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
      sun.set(1, user);

      // Mutate the record
      const result = sun.mutate(1, (draft) => {
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

      // Since we're using a deep clone approach, the original record should not be modified
      expect(user.address.city).toBe('Anytown');
      expect('zip' in user.address).toBe(false);
    });

    it('should handle array mutations', () => {
      // Set initial record
      const user = {
        id: 1,
        name: 'John Doe',
        tags: ['developer', 'javascript'],
      };
      sun.set(1, user);

      // Mutate the record
      const result = sun.mutate(1, (draft) => {
        if (draft && draft.tags) {
          draft.tags.push('typescript');
          draft.tags[0] = 'senior developer';
        }
      });

      // Check the result
      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        tags: ['senior developer', 'javascript', 'typescript'],
      });

      // Since we're using a deep clone approach, the original record should not be modified
      expect(user.tags).toEqual(['developer', 'javascript']);
    });
  });

  describe('Special Actions', () => {
    let univ: Universe;
    let schema: SchemaLocal;
    let coll: CollSync<any, string>;
    let sun: SunMemoryImmer<any, string>;

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
        sunF(coll) {
          sun = new SunMemoryImmer<any, string>(coll);
          return sun;
        },
      });

      // Set up initial data
      sun.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
      sun.set('user2', { id: 'user2', name: 'Jane Smith', age: 25 });
      sun.set('user3', {
        id: 'user3',
        name: 'Bob Johnson',
        age: 40,
        status: 'locked',
      });
    });

    describe('mutation', () => {
      it('should lock set operations during mutation', () => {
        // Mutate with a function that tries to set another record

        expect(() => {
          sun.mutate('user1', (draft, collection) => {
            collection.set('user4', {
              id: 'user4',
              name: 'New User',
              age: 22,
            });
            if (draft) {
              draft.name = 'Updated Name';
            }
            return draft;
          });
        }).toThrow();

        // Check that the original record was updated
        expect(sun.get('user1')?.name).toBe('John Doe');

        // Check that the new record was added (after the mutation completed)
        expect(sun.has('user4')).toBe(false);
      });

      it('should delete a record when returning DELETE action with key', () => {
        // Mutate with DELETE action
        const result = sun.mutate('user1', (draft) => {
          return { action: MUTATION_ACTIONS.DELETE, key: 'user1' };
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(sun.has('user1')).toBe(false);
      });

      it('should delete a record using the ID from the draft', () => {
        // Mutate with DELETE action using ID from draft
        const result = sun.mutate('user2', (draft) => {
          if (draft) {
            return { action: MUTATION_ACTIONS.DELETE, key: draft.id };
          }
        });

        // Result should be undefined
        expect(result).toBeUndefined();

        // Record should be deleted
        expect(sun.has('user2')).toBe(false);
      });

      it('should do nothing when returning NOOP action', () => {
        // Get the original record
        const original = sun.get('user3');

        // Mutate with NOOP action
        const result = sun.mutate('user3', (draft) => {
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
        expect(sun.get('user3')).toEqual(original);
      });

      it('should handle mutations that return a value', async () => {
        // Mutate with async function

        await sun.mutate('user1', (draft) => {
          if (draft) {
            // Update the draft
            draft.name = 'Updated Async';
            draft.age = 31;
          }
          return draft;
        });

        // Check that the record was updated
        const updated = sun.get('user1');
        expect(updated?.name).toBe('Updated Async');
        expect(updated?.age).toBe(31);
      });

      it('should throw on delete operations during mutation', () => {
        // Create a spy on the delete method

        // Mutate with a function that tries to delete another record
        expect(() => {
          sun.mutate('user1', (draft, collection) => {
            if (draft) {
              // Try to delete another record during mutation
              collection.delete('user2');

              // Update the draft
              draft.name = 'Updated Name';
              return draft;
            }
          });
        }).toThrow();

        // Check that the original record was updated
        expect(sun.get('user1')?.name).toBe('John Doe');

        // Check that the other record was deleted (after the mutation completed)
        expect(sun.has('user2')).toBe(true);
      });
    });
  });

  describe('Immerable classes', () => {
    /**
     * Abstract base class with id, name, and x, y, z properties
     */
    abstract class BaseEntity {
      id: string;
      name: string;
      x: number = 0;
      y: number = 0;
      z: number = 0;

      constructor(data: {
        id: string;
        name: string;
        x?: number;
        y?: number;
        z?: number;
      }) {
        this.id = data.id;
        this.name = data.name;
        if (data.x !== undefined) this.x = data.x;
        if (data.y !== undefined) this.y = data.y;
        if (data.z !== undefined) this.z = data.z;
      }

      /**
       * Returns a Three.js Vector3 representing the position
       */
      point(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
      }

      /**
       * Convert to a plain object for storage
       */
      toJSON() {
        return {
          id: this.id,
          name: this.name,
          x: this.x,
          y: this.y,
          z: this.z,
        };
      }
    }

    /**
     * Extended class with a position property that syncs with x, y, z
     */
    class PositionEntity extends BaseEntity {
      #position: Vector3;
      [immerable] = true;
      constructor(data: {
        id: string;
        name: string;
        x?: number;
        y?: number;
        z?: number;
      }) {
        super(data);
        this.#position = new Vector3(this.x, this.y, this.z);
      }

      /**
       * Get the position as a Vector3
       */
      get position(): Vector3 {
        // Always return a fresh Vector3 with current x, y, z values
        return new Vector3(this.x, this.y, this.z);
      }

      /**
       * Set the position from a Vector3, updating x, y, z
       */
      set position(value: Vector3) {
        // Update the base class properties
        this.x = value.x;
        this.y = value.y;
        this.z = value.z;

        // Update the cached position
        this.#position.copy(value);
      }

      /**
       * Override point to return the position
       */
      point(): Vector3 {
        return this.position;
      }

      /**
       * Create a PositionEntity from a plain object
       */
      static fromJSON(data: any): PositionEntity {
        return new PositionEntity({
          id: data.id,
          name: data.name,
          x: data.x,
          y: data.y,
          z: data.z,
        });
      }
    }

    /**
     * Custom schema filter to convert between PositionEntity and plain objects
     */
    function positionEntityFilter(params: any) {
      const { currentRecord, inputRecord } = params;

      // If input is already a PositionEntity, convert to plain object
      if (inputRecord instanceof PositionEntity) {
        return inputRecord.toJSON();
      }

      // If input is a plain object, convert to PositionEntity
      return PositionEntity.fromJSON(inputRecord);
    }

    let univ: Universe;
    let schema: SchemaLocal;
    let coll: CollSync<any, string>;
    let sun: SunMemoryImmer<any, string>;

    beforeEach(() => {
      univ = new Universe('test-universe');

      // Create schema with a record filter that handles PositionEntity conversion
      schema = new SchemaLocal(
        'entities',
        {
          id: { type: FIELD_TYPES.string },
          name: { type: FIELD_TYPES.string },
          x: { type: FIELD_TYPES.number },
          y: { type: FIELD_TYPES.number },
          z: { type: FIELD_TYPES.number },
        },
        positionEntityFilter,
      );

      coll = new CollSync({
        name: 'entities',
        schema,
        universe: univ,
        sunF(coll) {
          sun = new SunMemoryImmer<any, string>(coll);
          return sun;
        },
      });
    });

    describe('PositionEntity class', () => {
      it('should sync position with x, y, z properties', () => {
        const entity = new PositionEntity({ id: '1', name: 'Test Entity' });

        // Set position and check that x, y, z are updated
        entity.position = new Vector3(1, 2, 3);
        expect(entity.x).toBe(1);
        expect(entity.y).toBe(2);
        expect(entity.z).toBe(3);

        // Set x, y, z and check that position is updated
        entity.x = 4;
        entity.y = 5;
        entity.z = 6;
        expect(entity.position.x).toBe(4);
        expect(entity.position.y).toBe(5);
        expect(entity.position.z).toBe(6);
      });
    });

    describe('mutate with PositionEntity', () => {
      it('should store and retrieve a PositionEntity', () => {
        // Create a PositionEntity
        const entity = new PositionEntity({
          id: '1',
          name: 'Test Entity',
          x: 1,
          y: 2,
          z: 3,
        });

        // Store the entity
        sun.set('1', entity);

        // Retrieve the entity
        const retrieved = sun.get('1');

        // Check that it was converted to a PositionEntity
        expect(retrieved).toBeInstanceOf(PositionEntity);
        expect(retrieved.id).toBe('1');
        expect(retrieved.name).toBe('Test Entity');
        expect(retrieved.x).toBe(1);
        expect(retrieved.y).toBe(2);
        expect(retrieved.z).toBe(3);

        // Check that the point method works
        const point = retrieved.point();
        expect(point).toBeInstanceOf(Vector3);
        expect(point.x).toBe(1);
        expect(point.y).toBe(2);
        expect(point.z).toBe(3);
      });

      it('should mutate a PositionEntity using the position property', () => {
        // Create and store a PositionEntity
        const entity = new PositionEntity({
          id: '1',
          name: 'Test Entity',
          x: 1,
          y: 2,
          z: 3,
        });
        sun.set('1', entity);

        // Mutate the entity using the position property
        const result = sun.mutate('1', (draft) => {
          if (draft) {
            // Since draft is a plain object after JSON serialization,
            // we need to convert it back to a PositionEntity
            const posEntity = PositionEntity.fromJSON(draft);

            // Update the position
            posEntity.position = new Vector3(4, 5, 6);

            // Return the updated entity
            return posEntity;
          }
        });

        // Check the result
        expect(result).toBeInstanceOf(PositionEntity);
        expect(result.x).toBe(4);
        expect(result.y).toBe(5);
        expect(result.z).toBe(6);

        // Check that the stored entity was updated
        const stored = sun.get('1');
        expect(stored).toBeInstanceOf(PositionEntity);
        expect(stored.x).toBe(4);
        expect(stored.y).toBe(5);
        expect(stored.z).toBe(6);

        // Check that the point method returns the updated position
        const point = stored.point();
        expect(point.x).toBe(4);
        expect(point.y).toBe(5);
        expect(point.z).toBe(6);
      });

      it('should mutate a PositionEntity using the collection mutate method', () => {
        // Create and store a PositionEntity
        const entity = new PositionEntity({
          id: '1',
          name: 'Test Entity',
          x: 1,
          y: 2,
          z: 3,
        });
        coll.set('1', entity);

        // Mutate the entity using the collection mutate method
        const result = coll.mutate('1', (draft) => {
          if (draft) {
            // Since draft is a plain object after JSON serialization,
            // we need to convert it back to a PositionEntity
            const posEntity = PositionEntity.fromJSON(draft);

            // Update the position
            posEntity.position = new Vector3(7, 8, 9);

            // Return the updated entity
            return posEntity;
          }
        });

        // Check the result
        expect(result).toBeInstanceOf(PositionEntity);
        expect(result.x).toBe(7);
        expect(result.y).toBe(8);
        expect(result.z).toBe(9);

        // Check that the stored entity was updated
        const stored = coll.get('1');
        expect(stored).toBeInstanceOf(PositionEntity);
        expect(stored.x).toBe(7);
        expect(stored.y).toBe(8);
        expect(stored.z).toBe(9);
      });
    });
  });
});
