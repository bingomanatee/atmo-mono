import type { SchemaFieldBaseIF } from './type.schema';

export function isObj(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSchemaField(value: unknown): value is SchemaFieldBaseIF {
  if (!isObj(value)) {
    return false;
  }
  if ('filter' in value && typeof value.filter !== 'function') return false;
  return 'type' in value;
}
