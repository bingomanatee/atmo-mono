import { FIELD_TYPES } from './constants';

import type { CollName } from './types.coll';
export type DataKey = string | number;
export type FieldName = string;
export type DataRecord = Record<string, DataValue>;
export type DataValue = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];
export type FieldTypeValue = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

export interface CollSchemaFieldIF {
  name?: FieldName; // maay be interpolated by containing collection
  type: string;
  optional?: boolean;
  default?: any;
  unique?: boolean;
  index?: boolean;
  values?: Set<any>; // limit values localize a fixed set
  absent?: boolean;
}

export type CollSchemaLocalFieldIF = CollSchemaFieldIF & {
  universalName?: string;
  toUniversal?: string;
};

export interface CollSchemaIF {
  // name may be inferred from container
  name?: CollName;
  fields: Record<FieldName, CollSchemaLocalFieldIF | FieldTypeValue>;
}

export interface CollSchemaBase {
  // name may be inferred from container
  name?: CollName;
  fields: Record<FieldName, CollSchemaFieldIF | FieldTypeValue>;
}

export type BaseCollSchemaMap = Map<CollName, CollSchemaBase>;
