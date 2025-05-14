import { FIELD_TYPES } from './constants';

import type { CollName } from './types.coll';

export type DataKey = string | number;
export type FieldName = string;
export type DataRecord = Record<string, DataValue>;
export type DataValue = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];
export type FieldTypeValue = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

// ------------------- schema field types -------------------

/**
 * This information is not used by engines but may
 * influence filters or validation
 */
export type FieldAnnotation = {
  optional?: boolean; // !required
  defaultValue?: any;
  unique?: boolean;
  index?: boolean;
  values?: Set<any>; // limit values localize a fixed set
  absent?: boolean;
} & Record<string, any>; // other meta data

/**
 * the base collection field definition; also, the universal schema field definition
 */
export interface FieldBaseIF<RecordType = DataRecord> {
  name?: FieldName; // maay be interpolated by containing collection
  type: string;
  meta?: FieldAnnotation;
  validator?: ValidatorFn<RecordType>;
}

export interface FieldUnivIF<RecordType> extends FieldBaseIF<RecordType> {}

export type ValidatorFn<RecordType = DataRecord> = (
  value: any,
  params: ValidatorParams<RecordType>,
) => string | void;

type ValidatorParams<RecordType = DataRecord> = {
  field: FieldBaseIF;
  schema: SchemaBaseIF;
  record: RecordType;
};

export type FieldLocalIF<T = any> = FieldBaseIF & {
  name: string;
  universalName?: string;
  isLocal?: boolean; // if true, this field is not in the universal schema
  exportOnly?: boolean; // if true, this field is only used during toUniversal conversion and not written to local records
  filter?: (params: PostParams) => T; // when a record is set,
  // this is called immediately before writing to update or generate the field
  export?: (params: PostParams) => T; // used specifically during toUniversal conversion
  // to transform the value for the universal schema
};

export type FieldLocalInputIF = FieldLocalIF;
export type FieldBaseInputIF = FieldBaseIF;
export type LocalFieldRecord = Record<string, FieldLocalIF>;

// ------------------- schema nodes -------------------

export interface SchemaBaseIF {
  name?: CollName;
  fields: Record<FieldName, FieldBaseIF>;
}

export interface SchemaBaseInputIF {
  name?: CollName;
  fields: Record<FieldName, FieldLocalInputIF>;
  filterRecord?: (params: PostParams) => DataRecord;
}

export interface SchemaLocalIF<RecordType = DataRecord> extends SchemaBaseIF {
  name?: CollName; // name may be inferred from container
  fields: Record<FieldName, FieldLocalIF>;
  filterRecord?: (params: PostParams) => RecordType; // used to add local fields,
  // or to encase the record in a new class instance
}

/**
 * the schema a universe uses to establish the requirements of a universal collection
 */
export interface SchemaUnivIF extends SchemaBaseIF {
  // name may be inferred from container
  name?: CollName;
  fields: Record<FieldName, FieldBaseIF>;
}

export type PostParams = {
  currentRecord?: any;
  univName?: string;
  inputRecord: any;
  currentValue?: any;
  newValue?: any;
  field?: FieldBaseIF;
};

export type UnivSchemaMap = Map<CollName, SchemaUnivIF>;
