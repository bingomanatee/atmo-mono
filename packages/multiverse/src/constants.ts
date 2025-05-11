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

/**
 * Interface for mutation action results
 */
export interface MutationAction {
  /** The action to perform */
  action: symbol;
  /** Optional key for the record (required for DELETE) */
  key?: any;
  /** Optional value for the action */
  value?: any;
}
