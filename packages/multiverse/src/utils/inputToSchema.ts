import type {
  FieldTypeValue,
  LocalFieldRecord,
  SchemaLocalFieldIF,
  SchemaLocalFieldInputIF,
} from '../type.schema';

type Constructor<T = any> = new (...args: any[]) => T;

export function inputToSchema<
  SchemaType = SchemaLocalFieldIF,
  SchemaInputFieldType = SchemaLocalFieldInputIF,
>(
  schema: Record<string, SchemaInputFieldType | FieldTypeValue>,
  Klass?: Constructor<SchemaType>,
): LocalFieldRecord {
  const out: Record<string, SchemaType> = {};

  for (const [key, value] of Object.entries(schema)) {
    let def;
    if (typeof value === 'string') {
      def = { type: value, name: key };
    } else {
      def = value;
    }
    if (Klass) {
      out[key] = new Klass({ name: key, ...def });
    } else {
      out[key] = def;
    }
  }

  return out;
}
