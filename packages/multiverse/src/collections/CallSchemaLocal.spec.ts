import { describe, expect, it } from 'vitest';
import { FIELD_TYPES } from '../constants';
import { SchemaLocal } from '../SchemaLocal';
import type { PostParams } from '../type.schema';

describe('SchemaLocal', () => {
  describe('constructor', () => {
    it('should create a SchemaLocal with object field definitions', () => {
      const coll = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number, universalName: 'id' },
        name: { type: FIELD_TYPES.string, universalName: 'fullName' },
        address: { type: FIELD_TYPES.string, universalName: 'homeAddress' },
      });

      expect(coll.name).toBe('users');
      expect(coll.fields).toHaveProperty('id');
      expect(coll.fields).toHaveProperty('name');
      expect(coll.fields).toHaveProperty('address');
      expect(coll.fields.id.type).toBe(FIELD_TYPES.number);
      expect(coll.fields.name.universalName).toBe('fullName');
    });

    it('should create a SchemaLocal with array field definitions', () => {
      const coll = new SchemaLocal('users', [
        { name: 'id', type: FIELD_TYPES.number, universalName: 'id' },
        { name: 'name', type: FIELD_TYPES.string, universalName: 'fullName' },
        {
          name: 'address',
          type: FIELD_TYPES.string,
          universalName: 'homeAddress',
        },
      ]);

      expect(coll.name).toBe('users');
      expect(coll.fields).toHaveProperty('id');
      expect(coll.fields).toHaveProperty('name');
      expect(coll.fields).toHaveProperty('address');
      expect(coll.fields.id.type).toBe(FIELD_TYPES.number);
      expect(coll.fields.name.universalName).toBe('fullName');
    });

    it('should throw an error if array field definition is missing name', () => {
      expect(() => {
        new SchemaLocal('users', [
          { type: FIELD_TYPES.number, universalName: 'id' } as any,
        ]);
      }).toThrowError(/Field definition must have a name/);
    });

    it('should create a SchemaLocal with a filterRecord function', () => {
      const filterFn = (params: PostParams) => {
        return { ...params.inputRecord, processed: true };
      };

      const coll = new SchemaLocal(
        'users',
        {
          id: { type: FIELD_TYPES.number },
        },
        filterFn,
      );

      expect(coll.filterRecord).toBe(filterFn);
    });
  });

  describe('add method', () => {
    it('should add a new field to the collection', () => {
      const coll = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
      });

      coll.add({
        name: 'email',
        type: FIELD_TYPES.string,
        universalName: 'emailAddress',
      });

      expect(coll.fields).toHaveProperty('email');
      expect(coll.fields.email.type).toBe(FIELD_TYPES.string);
      expect(coll.fields.email.universalName).toBe('emailAddress');
    });

    it('should throw an error when adding a field with an existing name', () => {
      const coll = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
      });

      expect(() => {
        coll.add({
          name: 'id',
          type: FIELD_TYPES.string,
        });
      }).toThrowError(/Field id already exists/);
    });

    it('should add a field with meta information', () => {
      const coll = new SchemaLocal('users', {});

      coll.add({
        name: 'id',
        type: FIELD_TYPES.number,
        meta: {
          unique: true,
          index: true,
        },
      });

      expect(coll.fields.id.meta).toEqual({
        unique: true,
        index: true,
      });
    });

    it('should add a field with isLocal flag', () => {
      const coll = new SchemaLocal('users', {});

      coll.add({
        name: 'localField',
        type: FIELD_TYPES.string,
        isLocal: true,
      });

      expect(coll.fields.localField.isLocal).toBe(true);
    });

    it('should add a field with a filter function', () => {
      const coll = new SchemaLocal('users', {});
      const filterFn = (params: PostParams) => {
        return params.newValue ? params.newValue.toUpperCase() : '';
      };

      coll.add({
        name: 'name',
        type: FIELD_TYPES.string,
        filter: filterFn,
      });

      expect(coll.fields.name.filter).toBe(filterFn);
    });
  });

  describe('SchemaLocalIF implementation', () => {
    it('should implement the SchemaLocalIF interface', () => {
      const coll = new SchemaLocal('users', {
        id: { type: FIELD_TYPES.number },
        name: { type: FIELD_TYPES.string },
      });

      // Test that it has the required properties of SchemaLocalIF
      expect(coll).toHaveProperty('name');
      expect(coll).toHaveProperty('fields');
      expect(typeof coll.fields).toBe('object');

      // Optional property
      expect('filterRecord' in coll).toBe(true);
    });
  });

  describe('LocalCollField', () => {
    it('should create fields with correct properties', () => {
      const coll = new SchemaLocal('users', {});

      coll.add({
        name: 'id',
        type: FIELD_TYPES.number,
        universalName: 'userId',
        meta: { unique: true },
        isLocal: false,
      });

      const field = coll.fields.id;

      expect(field.name).toBe('id');
      expect(field.type).toBe(FIELD_TYPES.number);
      expect(field.universalName).toBe('userId');
      expect(field.meta).toEqual({ unique: true });
      expect(field.isLocal).toBe(false);
    });

    it('should have access to parent collection via c getter', () => {
      const coll = new SchemaLocal('users', {});

      coll.add({
        name: 'id',
        type: FIELD_TYPES.number,
      });

      const field = coll.fields.id;

      // Access the c getter which should return the parent collection
      expect(field.c).toBe(coll);
    });
  });
});
