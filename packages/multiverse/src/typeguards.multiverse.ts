import type { FieldBaseIF } from './type.schema';

export function isObj(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isField(value: unknown): value is FieldBaseIF {
  if (!isObj(value)) {
    return false;
  }
  if ('filter' in value && typeof value.filter !== 'function') return false;
  return 'type' in value;
}
