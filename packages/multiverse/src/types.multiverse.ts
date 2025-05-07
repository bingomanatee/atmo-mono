import { FIELD_TYPES } from './constants';

export type UniverseName = string;

export type DataKey = string | number;
export type DataValue = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];
export type DataRecord = Record<string, DataValue>;

// a system has a collection of uniform records
export interface CollIFBase<RecordType = DataRecord, KeyType = DataKey> {
  name: CollName;
  schema: CollSchema;
  get(name: string): RecordType | undefined;
  has(key: KeyType): boolean;
}

export interface CollEngineIF<RecordType = DataRecord, KeyType = DataKey> {
  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  delete(key: KeyType): void;
  clear(): void;
  has(key: KeyType): boolean;
}

export interface CollIFSync<RecordType = DataRecord, KeyType = DataKey>
  extends CollIFBase<RecordType, KeyType> {
  isAsync: false;
}

export interface CollIFAsync<RecordType = DataRecord, KeyType = DataKey>
  extends CollIFBase<RecordType, KeyType> {
  isAsync: true;
}

export type CollIF<RecordType = DataRecord, KeyType = DataKey> =
  | CollIFAsync<RecordType, KeyType>
  | CollIFSync<RecordType, KeyType>;

export interface UniverseIF {
  name: UniverseName;
  systems: Map<CollName, CollIF>;
}

export type CollName = string;

export type FieldName = string;

export type CollSchemaField = {
  name: FieldName;
  type: string;
  optional?: boolean;
  default?: any;
  unique?: boolean;
  index?: boolean;
  values?: string[];
};

export interface CollSchema {
  name: CollName;
  schema: Record<FieldName, CollSchemaField>;
}

// a universe is a "collection of systems" that have the same collection schema sets
export interface UniversalSchema {
  systems: Map<CollName, CollSchema>;
}

// but with "variations" in each universe.
export interface MultiverseIF {
  has(name: UniverseName): boolean;
  get(name: UniverseName): UniverseIF | undefined;
  baseSchema: UniversalSchema;
}
