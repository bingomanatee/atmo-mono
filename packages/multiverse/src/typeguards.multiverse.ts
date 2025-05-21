import { MUTATION_ACTIONS_VALUES } from './constants';
import type { FieldBaseIF } from './type.schema';
import type { MutationAction } from './types.multiverse';

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

/**
 * Type guard for Promise-like objects
 * Checks if an object has a `then` method
 */
export function isPromiseLike(value: unknown): value is PromiseLike<any> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'then' in (value as object) &&
    typeof (value as any).then === 'function'
  );
}

export function isMutatorAction(value: unknown): value is MutationAction {
  if (!isObj(value)) {
    return false;
  }
  const obj = value as object;
  if (!('action' in obj)) {
    return false;
  }

  return MUTATION_ACTIONS_VALUES.includes(obj.action as symbol);
}
