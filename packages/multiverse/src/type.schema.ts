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
  default?: any;
  unique?: boolean;
  index?: boolean;
  values?: Set<any>; // limit values localize a fixed set
  absent?: boolean;
} & Record<string, any>; // other meta data

/**
 * the base collection field definition
 */
export interface SchemaFieldBaseIF<RecordType = DataRecord> {
  name?: FieldName; // maay be interpolated by containing collection
  type: string;
  meta?: FieldAnnotation;
  validator?: ValidatorFn<RecordType>;
}

export type ValidatorFn<RecordType = DataRecord> = (
  value: any,
  params: ValidatorParams<RecordType>,
) => string | void;

type ValidatorParams<RecordType = DataRecord> = {
  field: SchemaFieldBaseIF;
  schema: SchemaBaseIF;
  record: RecordType;
};

export type SchemaLocalFieldIF<T = any> = SchemaFieldBaseIF & {
  universalName?: string;
  isLocal?: boolean; // if true, this field is not in the universal schema
  filter?: (params: PostParams) => T; // when a record is set,
  // this is called immediately before writing to update or generate the field
};

export type SchemaLocalFieldInputIF = SchemaLocalFieldIF | FieldTypeValue;

export type LocalFieldRecord = Record<string, SchemaLocalFieldIF>;

// ------------------- schema nodes -------------------

export interface SchemaBaseIF {
  name?: CollName;
  fields: Record<FieldName, SchemaFieldBaseIF>;
}

export interface SchemaBaseInputIF {
  name?: CollName;
  fields: Record<FieldName, SchemaLocalFieldInputIF>;
  filterRecord?: (params: PostParams) => DataRecord;
}

export interface SchemaLocalIF<RecordType = DataRecord> extends SchemaBaseIF {
  name?: CollName; // name may be inferred from container
  fields: Record<FieldName, SchemaLocalFieldIF>;
  filterRecord?: (params: PostParams) => RecordType; // used to add local fields,
  // or to encase the record in a new class instance
}

/**
 * the schema a universe uses to establish the requirements of a universal collection
 */
export interface SchemaUnivIF extends SchemaBaseIF {
  // name may be inferred from container
  name?: CollName;
  fields: Record<FieldName, SchemaFieldBaseIF>;
}

export type PostParams = {
  currentRecord?: any;
  univName?: string;
  inputRecord: any;
  currentValue?: any;
  newValue?: any;
  field?: SchemaFieldBaseIF;
};

export type UnivSchemaMap = Map<CollName, SchemaUnivIF>;
