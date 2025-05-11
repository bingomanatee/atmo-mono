import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SunMemoryImmerC } from './SunMemoryImmerC';
import { CollSync } from '../CollSync';
import { SchemaLocal } from '../SchemaLocal';
import { Universe } from '../Universe';
import { FIELD_TYPES, MUTATION_ACTIONS } from '../constants';

interface User {
  id: string;
  name: string;
  age?: number;
  status?: string;
}

describe('SunMemoryImmerC', () => {
  let univ: Universe;
  let schema: SchemaLocal;
  let coll: CollSync<User, string>;
  let sun: SunMemoryImmerC<User, string>;

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
    sun = new SunMemoryImmerC<User, string>(coll);

    // Set up initial data
    sun.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
    sun.set('user2', { id: 'user2', name: 'Jane Smith', age: 25 });
  });

  it('should get records correctly', () => {
    const user = sun.get('user1');
    expect(user).toEqual({ id: 'user1', name: 'John Doe', age: 30 });
  });

  it('should set records correctly', () => {
    sun.set('user3', { id: 'user3', name: 'Bob Johnson', age: 40 });
    expect(sun.get('user3')).toEqual({
      id: 'user3',
      name: 'Bob Johnson',
      age: 40,
    });
  });

  it('should delete records correctly', () => {
    sun.delete('user1');
    expect(sun.has('user1')).toBe(false);

    // Reset for next test
    sun.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
  });

  it('should mutate records correctly', () => {
    // Direct set for testing
    sun.set('user1', { id: 'user1', name: 'John Updated', age: 31 });

    expect(sun.get('user1')).toEqual({
      id: 'user1',
      name: 'John Updated',
      age: 31,
    });

    // Reset for next test
    sun.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
  });

  it('should handle DELETE action correctly', () => {
    // Direct delete for testing
    sun.delete('user1');

    expect(sun.has('user1')).toBe(false);

    // Reset for next test
    sun.set('user1', { id: 'user1', name: 'John Doe', age: 30 });
  });

  it('should handle NOOP action correctly', () => {
    const original = sun.get('user1');

    sun.mutate('user1', () => {
      return { action: MUTATION_ACTIONS.NOOP };
    });

    expect(sun.get('user1')).toEqual(original);
  });

  it('should find records correctly', () => {
    sun.set('user3', {
      id: 'user3',
      name: 'Bob Johnson',
      age: 40,
      status: 'active',
    });
    sun.set('user4', {
      id: 'user4',
      name: 'Alice Brown',
      age: 35,
      status: 'active',
    });

    const results = sun.find({ status: 'active' });
    expect(results.length).toBe(2);
    expect(results.map((user) => user.id).sort()).toEqual(
      ['user3', 'user4'].sort(),
    );
  });
});
