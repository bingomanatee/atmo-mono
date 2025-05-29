export const FIELD_TYPES = {
  string: 'string',
  number: 'number',
  boolean: 'bool',
  date: 'Date',
  object: 'Object',
  array: 'Array',
  function: 'Function',
  custom: 'custom',
  any: '*',
} as const;

export type FieldTypeName = keyof typeof FIELD_TYPES; // 'string' | 'number' | ...
export type FieldTypeValue = (typeof FIELD_TYPES)[FieldTypeName]; // 'string' | 'number' | 'bool' | ...

/**
 * Special action symbols for mutation operations
 */
export const MUTATION_ACTIONS = {
  /** Delete the record */
  DELETE: Symbol('DELETE'),
  /** Do nothing with the record */
  NOOP: Symbol('NOOP'),
  /** Lock the collection during mutation */
  LOCK: Symbol('LOCK'),
  /** Unlock the collection after mutation */
  UNLOCK: Symbol('UNLOCK'),
} as const;

export const MUTATION_ACTIONS_VALUES = Array.from(
  Object.values(MUTATION_ACTIONS),
);

/**
 * Special symbols for stream operations
 */
export const STREAM_ACTIONS = {
  /** Terminate the stream immediately */
  TERMINATE: Symbol('TERMINATE_STREAM'),
  /** Create a new record */
  CREATE: Symbol('CREATE_RECORD'),
  /** Update an existing record */
  UPDATE: Symbol('UPDATE_RECORD'),
  /** Delete a record */
  DELETE: Symbol('DELETE_RECORD'),
} as const;
