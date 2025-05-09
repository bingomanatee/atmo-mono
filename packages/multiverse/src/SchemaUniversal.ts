import type {
  DataRecord,
  FieldAnnotation,
  FieldTypeValue,
  LocalFieldRecord,
  PostParams,
  SchemaFieldBaseIF,
  SchemaFieldBaseInputIF,
  SchemaLocalFieldIF,
  SchemaLocalFieldInputIF,
  SchemaLocalIF,
  SchemaUnivIF,
} from './type.schema';
import { isObj } from './typeguards.multiverse';
import { inputToSchema } from './utils/inputToSchema';

function arrayToFields(fieldDef: SchemaFieldBaseIF[]) {
  return fieldDef.reduce(
    (acc, field) => {
      if (!('name' in field)) {
        throw new Error(
          'Field definition must have a name if injected as an array',
        );
      }
      acc[field.name as string] = field;
      return acc;
    },
    {} as Record<string, SchemaLocalFieldIF>,
  );
}

export class UnivCollField<T = any> implements SchemaFieldBaseIF<T> {
  constructor(
    params: LocalCollAddParams<T>,
    private coll: SchemaLocal,
  ) {
    const { name, type, meta, universalName, isLocal, filter } = params;

    this.name = name;
    this.type = type;
    if (isObj(meta)) {
      this.meta = meta;
    }
    if (universalName) {
      this.universalName = universalName;
    }
    this.isLocal = !!isLocal;
    if (filter && typeof filter === 'function') {
      this.filter = filter;
    }
  }

  name?: string | undefined;
  type: string;
  meta?: FieldAnnotation | undefined;
  universalName?: string | undefined;
  isLocal?: boolean | undefined;
  filter?: (params: PostParams) => T;

  get c() {
    return this.coll;
  }
}

export class SchemaUniversal<RecordType = DataRecord>
  implements SchemaUnivIF<RecordType>
{
  constructor(
    public name: string,
    fieldDef:
      | Record<string, SchemaFieldBaseInputIF | FieldTypeValue>
      | SchemaFieldBaseIF[],
    public filterRecord?: (params: PostParams) => RecordType,
  ) {
    if (Array.isArray(fieldDef)) {
      this.fields = arrayToFields(fieldDef);
    } else {
      this.fields = inputToSchema(fieldDef, UnivCollField);
    }
  }

  fields: Record<string, SchemaFieldBaseIF>;

  add<T = any>(params: LocalCollAddParams<T>) {
    const { name, type, meta } = params;
    if (name in this.fields) {
      throw new Error(
        `Field ${name} already exists in collection ${this.name}`,
      );
    }
    const newField = new LocalCollField(params, this);
    this.fields[name] = newField;
  }
}

type LocalCollAddParams<T> = {
  name: string;
  type: FieldTypeValue;
  meta?: FieldAnnotation;
  universalName?: string | undefined;
  isLocal?: boolean | undefined;
  filter?: (params: PostParams) => T;
};
