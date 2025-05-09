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
