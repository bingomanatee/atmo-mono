// a system has a collection of uniform records
import type { CollSchemaIF, DataKey, DataRecord } from './type.schema';
import type { UniverseName } from './types.multiverse';

export interface CollBaseIF<RecordType = DataRecord, KeyType = DataKey> {
  name: CollName;
  schema: CollSchemaIF;

  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  has(key: KeyType): boolean;
}

export interface CollSyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF<RecordType, KeyType> {
  name: CollName;
  schema: CollSchemaIF;

  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  has(key: KeyType): boolean;
  send(key: KeyType, target: UniverseName): void;
  isAsync: false;
}

export interface CollAsyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF<RecordType, KeyType> {
  isAsync: true;
}

export type CollName = string;
export type CollIF<RecordType = DataRecord, KeyType = DataKey> =
  | CollAsyncIF<RecordType, KeyType>
  | CollSyncIF<RecordType, KeyType>;
