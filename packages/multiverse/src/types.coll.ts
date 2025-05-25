// a system has a collection of uniform records
import type { Observable } from 'rxjs';
import type { DataKey, DataRecord, SchemaLocalIF } from './type.schema';
import type {
  MutationAction,
  SendProps,
  TransportResult,
  UniverseName,
} from './types.multiverse';

// ------------------- collection nodes -------------------

export interface CollBaseIF<RecordType = DataRecord, KeyType = DataKey> {
  name: CollName;
  schema: SchemaLocalIF;
  isAsync: boolean;
  find(
    ...query: any[]
  ):
    | Generator<{ key: KeyType; value: RecordType }>
    | Generator<Map<KeyType, RecordType>>;
  get(key: KeyType): RecordType | undefined | Promise<RecordType | undefined>;
  values():
    | Generator<[KeyType, RecordType]>
    | AsyncGenerator<[KeyType, RecordType]>;
  getMany(
    keys: KeyType[],
    batchSize?: number,
  ):
    | Generator<{ key: KeyType; value: RecordType }>
    | Generator<Map<KeyType, RecordType>>;
  has(key: KeyType): boolean | Promise<boolean>;
  send(key: KeyType, target: UniverseName): TransportResult;
  sendAll(props: SendProps<RecordType, KeyType>): TransportResult;
  sendMany(
    keys: KeyType[],
    props: SendProps<RecordType, KeyType>,
  ): TransportResult;
  set(key: KeyType, value: RecordType): void | Promise<void>;
  setMany(values: Map<KeyType, RecordType>): void | Promise<void>;
  delete(key: KeyType): void | Promise<void>;
  [Symbol.iterator](): Iterator<[KeyType, RecordType]>;
}

export interface CollSyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF<RecordType, KeyType> {
  count(): number;
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => void,
  ): void;
  find(...query: any[]): Generator<{ key: KeyType; value: RecordType }>;
  get(key: KeyType): RecordType | undefined;
  values(): Generator<[KeyType, RecordType]>;
  getMany(keys: KeyType[]): Generator<{ key: KeyType; value: RecordType }>;
  has(key: KeyType): boolean;
  isAsync: false;
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ): number;
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
  ): RecordType | undefined;
  name: CollName;
  schema: SchemaLocalIF;
  send(key: KeyType, target: UniverseName): TransportResult;
  sendAll(props: SendProps<RecordType, KeyType>): TransportResult;
  sendMany(
    keys: KeyType[],
    props: SendProps<RecordType, KeyType>,
  ): TransportResult;
  set(key: KeyType, value: RecordType): void;
  setMany(values: Map<KeyType, RecordType>): void;
  delete(key: KeyType): void;
  [Symbol.iterator](): Iterator<[KeyType, RecordType]>;
}

export interface CollAsyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF<RecordType, KeyType> {
  count(): Promise<number>;
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => void | Promise<void>,
  ): Promise<void>;
  find(...query: any[]): Generator<Map<KeyType, RecordType>>;
  get(key: KeyType): Promise<RecordType | undefined>;
  values(): AsyncGenerator<[KeyType, RecordType]>;
  getMany(
    keys: KeyType[],
    batchSize?: number,
  ): Generator<Map<KeyType, RecordType>>;
  has(key: KeyType): Promise<boolean>;
  isAsync: true;
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => RecordType | void | any | Promise<RecordType | void | any>,
  ): Promise<Map<KeyType, RecordType>>;
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => Promise<RecordType | MutationAction>,
  ): Promise<RecordType | undefined>;
  send(key: KeyType, target: UniverseName): TransportResult;
  sendAll(props: SendProps<RecordType, KeyType>): TransportResult;
  sendMany(
    keys: KeyType[],
    props: SendProps<RecordType, KeyType>,
  ): TransportResult;
  set(key: KeyType, value: RecordType): Promise<void>;
  setMany(input: Map<KeyType, RecordType>): Promise<void>;
  [Symbol.iterator](): Iterator<[KeyType, RecordType]>;
}

export type CollName = string;
export type CollIF<RecordType = DataRecord, KeyType = DataKey> =
  | CollAsyncIF<RecordType, KeyType>
  | CollSyncIF<RecordType, KeyType>;
