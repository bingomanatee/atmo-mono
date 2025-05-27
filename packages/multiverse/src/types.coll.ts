// a system has a collection of uniform records
import type { Observable } from 'rxjs';
import type { DataKey, DataRecord, SchemaLocalIF, Pair } from './type.schema';
import type {
  MutationAction,
  SendProps,
  SunIF,
  TransportResult,
  UniverseName,
} from './types.multiverse';

// ------------------- collection nodes -------------------

export interface CollBaseIF<RecordType = DataRecord, KeyType = DataKey> {
  name: CollName;
  debug?: boolean;
  schema: SchemaLocalIF;
  isAsync: boolean;
  find(...query: any[]): any;
  values(): any;
  getMany(keys: KeyType[]): any;
  get(key: KeyType): RecordType | undefined | Promise<RecordType | undefined>;
  has(key: KeyType): boolean | Promise<boolean>;
  send(key: KeyType, target: UniverseName): TransportResult;
  sendAll(props: SendProps<RecordType, KeyType>): TransportResult;
  sendMany(
    keys: KeyType[],
    props: SendProps<RecordType, KeyType>,
  ): TransportResult;
  set(
    key: KeyType,
    value: RecordType,
    skipValidate?: boolean,
  ): void | Promise<void>;
  setMany(values: Map<KeyType, RecordType>): void | Promise<void>;
  delete(key: KeyType): void | Promise<void>;
  [Symbol.iterator](): Iterator<Pair<KeyType, RecordType>>;
  sun: SunIF;
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
  find(...criteria: any[]): Generator<Pair<KeyType, RecordType>>;
  values(): Generator<Pair<KeyType, RecordType>>;
  getMany(keys: KeyType[]): Map<KeyType, RecordType>;
  has(key: KeyType): boolean;
  isAsync: false;
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | MutationAction,
    noTransaction?: boolean,
  ): Map<KeyType, RecordType>;
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | MutationAction,
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
  [Symbol.iterator](): Iterator<Pair<KeyType, RecordType>>;
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
  find(...query: any[]): AsyncGenerator<Pair<KeyType, RecordType>>;
  values(): AsyncGenerator<Pair<KeyType, RecordType>>;
  getMany(keys: KeyType[]): Promise<Map<KeyType, RecordType>>;
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
  set(key: KeyType, value: RecordType, skiplValidate?: boolean): Promise<void>;
  setMany(input: Map<KeyType, RecordType>): Promise<void>;
  [Symbol.iterator](): Iterator<Pair<KeyType, RecordType>>;
}

export type CollName = string;
export type CollIF<RecordType = DataRecord, KeyType = DataKey> =
  | CollAsyncIF<RecordType, KeyType>
  | CollSyncIF<RecordType, KeyType>;

export type CollSyncMutator<RecordType = DataRecord, KeyType = DataKey> = (
  draft: RecordType | undefined,
  collection: CollSyncIF<RecordType, KeyType>,
) => RecordType | MutationAction;
