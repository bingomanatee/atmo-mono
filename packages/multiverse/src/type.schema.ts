import { FIELD_TYPES } from './constants';

import type { CollName } from './types.coll';

export type DataKey = string | number;
export type FieldName = string;
export type DataRecord = Record<string, DataValue>;
export type DataValue = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];
export type FieldTypeValue = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

// ------------------- schema field types -------------------

/**
 * This information is not used by suns but may
 * influence filters or validation
 */
export type FieldAnnotation = {
  optional?: boolean; // !required
  defaultValue?: any;
  unique?: boolean;
  index?: boolean;
  values?: Set<any>; // limit values localize a fixed set
  absent?: boolean;
  mapTo?: string[]; // Array of field names to map to/from for bidirectional mapping
} & Record<string, any>; // other meta data

/**
 * the base collection field definition; also, the universal schema field definition
 */
export interface FieldBaseIF<RecordType = DataRecord> {
  name?: FieldName; // maay be interpolated by containing collection
  type: string;
  meta?: FieldAnnotation;
  validator?: ValidatorFn<RecordType>;
  import?: (params: PostParams) => any; // Used for universal → local transformations
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
  import?: (params: PostParams) => T; // used specifically during toLocal conversion
  // to transform the value from the universal schema
  univFields?: Record<string, string>; // Simple mapping of local field names to universal field names
  // Used to pre-populate complex objects during toLocal conversion
};

export type FieldLocalInputIF = FieldLocalIF;
export type FieldBaseInputIF = FieldBaseIF;
export type LocalFieldRecord = Record<string, FieldLocalIF>;

// ------------------- schema nodes -------------------

export interface SchemaBaseIF {
  name?: CollName;
  fields: Record<FieldName, FieldBaseIF>;
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
  // Used to transform values during toLocal conversion
  import?: (params: PostParams) => any;
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
