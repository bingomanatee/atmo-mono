import type { CollSchemaFieldIF, CollSchemaLocalIF } from './type.schema';

export function isObj(fromSchema: unknown): fromSchema is object {
  return typeof fromSchema === 'object' && fromSchema !== null;
}

export function isCollSchemaField(
  fromSchema: unknown,
): fromSchema is CollSchemaFieldIF {
  if (!isObj(fromSchema)) {
    return false;
  }
  return 'type' in fromSchema;
}
