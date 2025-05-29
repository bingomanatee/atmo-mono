// a system has a collection of uniform records
import type { Observable } from 'rxjs';
import type { DataKey, DataRecord, SchemaLocalIF, Pair } from './type.schema';
import type {
  MutationAction,
  MutatorSync,
  MutatorAsync,
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

  // Use any for methods that differ between sync/async
  find(...query: any[]): any; // Generator | AsyncGenerator
  values(): any; // Generator | AsyncGenerator
  getMany(keys: KeyType[]): any; // Map | Promise<Map>
  get(key: KeyType): any; // RecordType | undefined | Promise<RecordType | undefined>
  has(key: KeyType): any; // boolean | Promise<boolean>
  send(key: KeyType, target: UniverseName): any; // TransportResult | Promise<TransportResult>
  sendAll(props: any): any; // TransportResult | Promise<TransportResult>
  sendMany(keys: KeyType[], props: any): any; // TransportResult | Promise<TransportResult>
  set(key: KeyType, value: RecordType, skipValidate?: boolean): any; // void | Promise<void>
  setMany(values: Map<KeyType, RecordType>): any; // void | Promise<void>
  delete(key: KeyType): any; // void | Promise<void>
  [Symbol.iterator](): any; // Iterator | AsyncIterator

  // Sun can be either sync or async
  sun: any; // SunIF | SunIFSync | SunIfAsync

  // Methods that might exist in subclasses
  count?(): any; // number | Promise<number>
  each?(callback: any): any; // void | Promise<void>
  map?(mapper: any, noTransaction?: boolean): any; // Map | Promise<Map>
  mutate?(key: KeyType, mutator: any): any; // RecordType | Promise<RecordType>
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
  ): Generator<Pair<KeyType, RecordType>>;
  mutate(
    key: KeyType,
    mutator: MutatorSync<RecordType, KeyType>,
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
    ) => RecordType | void | MutationAction,
  ): AsyncGenerator<Pair<KeyType, RecordType>>;
  mutate(
    key: KeyType,
    mutator: MutatorAsync<RecordType, KeyType>,
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
