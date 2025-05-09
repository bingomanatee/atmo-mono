// a system has a collection of uniform records
import type { SchemaLocalIF, DataKey, DataRecord } from './type.schema';
import type { UniverseName } from './types.multiverse';

// ------------------- collection nodes -------------------

export interface CollBaseIF<RecordType = DataRecord, KeyType = DataKey> {
  name: CollName;
  schema: SchemaLocalIF;

  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  has(key: KeyType): boolean;
}

export interface CollSyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF<RecordType, KeyType> {
  name: CollName;
  schema: SchemaLocalIF;

  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  has(key: KeyType): boolean;
  send(key: KeyType, target: UniverseName): void;
  isAsync: false;
}

export interface CollAsyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF<RecordType, KeyType> {
  isAsync: true;
  get(key: KeyType): Promise<RecordType | undefined>;
  set(key: KeyType, value: RecordType): Promise<void>;
  has(key: KeyType): Promise<boolean>;
  send(key: KeyType, target: UniverseName): Promise<void>;
}

export type CollName = string;
export type CollIF<RecordType = DataRecord, KeyType = DataKey> =
  | CollAsyncIF<RecordType, KeyType>
  | CollSyncIF<RecordType, KeyType>;
