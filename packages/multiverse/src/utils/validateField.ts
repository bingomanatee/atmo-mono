import { FieldTypeValue, SchemaBaseIF } from '../type.schema';
import { FIELD_TYPES } from '../constants';
import { isObj } from '../typeguards.multiverse';

const isType = (s: string) => (value: any) => typeof value === s;
const validatorMap: Map<FieldTypeValue, (value: any) => boolean> = new Map();
validatorMap.set(FIELD_TYPES.string, isType('string'));
validatorMap.set(FIELD_TYPES.number, isType('number'));
validatorMap.set(FIELD_TYPES.boolean, isType('boolean'));
validatorMap.set(FIELD_TYPES.object, isObj);
validatorMap.set(FIELD_TYPES.array, Array.isArray);
validatorMap.set(FIELD_TYPES.function, isType('function'));
validatorMap.set(FIELD_TYPES.date, (value: any) => {
  return value instanceof Date;
});

export function validateField(
  value: unknown,
  key: string,
  schema: SchemaBaseIF,
) {
  const fieldSchema = schema.fields[key];
  if (!fieldSchema) {
    throw new Error(`Field ${key} not found in schema`);
  }
  const { type: fieldType } = fieldSchema;
  const validator = validatorMap.get(fieldType as FieldTypeValue);
  if (!validator) {
    return false;
  }
  return validator(value) ? false : `${key} is not a valid ${fieldType}`;
}
