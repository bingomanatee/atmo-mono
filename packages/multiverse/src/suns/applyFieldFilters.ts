import type { FieldLocalIF, SchemaBaseIF } from '../type.schema';
import { isObj } from '../typeguards.multiverse';

export function applyFieldFilters<R>(
  input: R,
  existing: R,
  schema: SchemaBaseIF,
) {
  if (!isObj(input)) return input;

  let record = { ...input };

  for (const fieldName of Object.keys(schema.fields)) {
    const field: FieldLocalIF<R> | undefined = schema.fields[fieldName];

    if (field && typeof field.filter === 'function') {
      const newValue = (record as { [fieldName]: any })[fieldName];
      const currentValue = isObj(existing)
        ? (existing as { [fieldName]: any })[fieldName]
        : undefined;
      try {
        const fieldValue: any = field.filter({
          currentRecord: existing,
          inputRecord: record,
          field,
          currentValue,
          newValue,
        });
        (record as { [fieldName]: any })[fieldName] = fieldValue;
      } catch (err) {
        console.error('field filter error:', err, fieldName, record);
        throw err;
      }
    }
  }
  return record;
}
