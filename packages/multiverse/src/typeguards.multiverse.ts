import { MUTATION_ACTIONS_VALUES } from './constants';
import type { FieldBaseIF } from './type.schema';
import type { MutationAction } from './types.multiverse';
import type { CollIF } from './types.coll';
import { CollBase } from './collections/CollBase';

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

// Type guard for collection objects
export function isColl(obj: any): obj is CollIF {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.name !== 'string') return false;
  if (!obj.schema || typeof obj.schema !== 'object') return false;
  if (typeof obj.isAsync !== 'boolean') return false;

  // Core methods from CollBaseIF - only check essential ones
  if (typeof obj.get !== 'function') return false;
  if (typeof obj.set !== 'function') return false;
  if (typeof obj.has !== 'function') return false;
  if (typeof obj.delete !== 'function') return false;

  return true;
}
