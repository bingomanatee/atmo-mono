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
  optional?: boolean;
  default?: any;
  unique?: boolean;
  index?: boolean;
  values?: Set<any>; // limit values localize a fixed set
  absent?: boolean;
} & Record<string, any>; // other meta data

export type PostParams = {
  currentRecord?: any;
  univName?: string;
  inputRecord: any;
  currentValue?: any;
  newValue?: any;
  field?: CollSchemaFieldIF;
};

/**
 * the base collection field definition
 */
export interface CollSchemaFieldIF {
  name?: FieldName; // maay be interpolated by containing collection
  type: string;
  meta?: FieldAnnotation;
}

export type CollSchemaLocalFieldIF<T = any> = CollSchemaFieldIF & {
  universalName?: string;
  isLocal?: boolean; // if true, this field is not in the universal schema
  filter?: (params: PostParams) => T; // when a record is set,
  // this is called immediately before writing to update or generate the field
};

// ------------------- schema nodes -------------------

export interface CollSchemaBaseIF {
  name?: CollName;
  fields: Record<FieldName, CollSchemaFieldIF | FieldTypeValue>;
}

export interface CollSchemaLocalIF<T = DataRecord> extends CollSchemaBaseIF {
  name?: CollName; // name may be inferred from container
  fields: Record<FieldName, CollSchemaLocalFieldIF | FieldTypeValue>;
  filterRecord?: (params: PostParams) => T; // used to add local fields,
  // or to encase the record in a new class instance
}

/**
 * the schema a universe uses to establish the requirements of a universal collection
 */
export interface CollSchemaUnivIF extends CollSchemaBaseIF {
  // name may be inferred from container
  name?: CollName;
  fields: Record<FieldName, CollSchemaFieldIF | FieldTypeValue>;
}

export type UnivCollSchemaMap = Map<CollName, CollSchemaUnivIF>;
