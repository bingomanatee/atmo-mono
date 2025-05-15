import type {
  DataRecord,
  FieldAnnotation,
  FieldLocalIF,
  FieldLocalInputIF,
  FieldTypeValue,
  LocalFieldRecord,
  PostParams,
  SchemaLocalIF,
  ValidatorFn,
} from './type.schema';
import { isObj } from './typeguards.multiverse';
import { inputToSchema } from './utils/inputToSchema';

function arrayToFields(fieldDef: FieldLocalIF[]) {
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
    {} as Record<string, FieldLocalIF>,
  );
}

class LocalCollField<T = any> implements FieldLocalIF<T> {
  constructor(
    params: LocalCollAddParams<T>,
    private coll: SchemaLocal,
  ) {
    const {
      name,
      type,
      meta,
      universalName,
      isLocal,
      exportOnly,
      filter,
      export: exportFn,
      import: importFn,
      validator,
      univFields,
    } = params;
    if (!name) {
      throw new Error('name is required in LocalCollField');
    }
    this.name = name;
    this.type = type;
    if (isObj(meta)) {
      this.meta = meta;
    }
    if (universalName) {
      this.universalName = universalName;
    }
    this.isLocal = !!isLocal;
    this.exportOnly = !!exportOnly;
    if (filter && typeof filter === 'function') {
      this.filter = filter;
    }
    if (exportFn && typeof exportFn === 'function') {
      this.export = exportFn;
    }
    if (importFn && typeof importFn === 'function') {
      this.import = importFn;
    }
    if (validator && typeof validator === 'function') {
      this.validator = validator;
    }
    if (univFields && isObj(univFields)) {
      this.univFields = univFields;
    }
  }

  name?: string | undefined;
  type: string;
  meta?: FieldAnnotation | undefined;
  universalName?: string | undefined;
  isLocal?: boolean | undefined;
  exportOnly?: boolean | undefined;
  validator?: ValidatorFn | undefined;
  filter?: (params: PostParams) => T;
  export?: (params: PostParams) => T;
  import?: (params: PostParams) => T;
  univFields?: Record<string, string>;

  get c() {
    return this.coll;
  }
}

export class SchemaLocal<RecordType = DataRecord>
  implements SchemaLocalIF<RecordType>
{
  constructor(
    public name: string,
    fieldDef: Record<string, FieldLocalInputIF> | FieldLocalIF[],
    public filterRecord?: (params: PostParams) => RecordType,
  ) {
    if (Array.isArray(fieldDef)) {
      this.fields = arrayToFields(fieldDef);
    } else {
      this.fields = inputToSchema<FieldLocalIF, FieldLocalInputIF>(
        fieldDef,
        LocalCollField,
      );
    }
  }

  fields: LocalFieldRecord;

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
  exportOnly?: boolean | undefined;
  filter?: (params: PostParams) => T;
  export?: (params: PostParams) => T;
  import?: (params: PostParams) => T;
  validator?: (value: T) => any;
  univFields?: Record<string, string>;
};
