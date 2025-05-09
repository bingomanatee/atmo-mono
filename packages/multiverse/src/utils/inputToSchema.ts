import type { SchemaLocalFieldInputIF, LocalFieldRecord } from '../type.schema';

export function inputToSchema(
  schema: Record<string, SchemaLocalFieldInputIF>,
): LocalFieldRecord {
  const out: LocalFieldRecord = {};

  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === 'string' || typeof value === 'number') {
      out[key] = { type: value, name: key };
    } else {
      out[key] = value;
    }
  }

  return out;
}
