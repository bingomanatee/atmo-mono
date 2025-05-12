import type { SchemaBaseIF } from '../type.schema';
import { isObj } from '../typeguards.multiverse';

export function applyFieldFilters<R>(
  record: R,
  existing: R,
  schema: SchemaBaseIF,
) {
  if (!isObj(record)) return record;
  record = { ...record };
  for (const fieldName of Object.keys(schema.fields)) {
    const field = schema.fields[fieldName];

    if (field.filter) {
      const newValue = (record as { [fieldName]: any })[fieldName];
      const currentValue = isObj(existing)
        ? (existing as { [fieldName]: any })[fieldName]
        : undefined;
      const fieldValue: any = field.filter({
        currentRecord: existing,
        inputRecord: record,
        field,
        currentValue,
        newValue,
      });
      (record as { [fieldName]: any })[fieldName] = fieldValue;
    }
  }
  return record;
}
