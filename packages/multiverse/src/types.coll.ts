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

export interface CollBaseIF {
  name: CollName;
  schema: SchemaLocalIF;

  /**
   * Find records matching a query and return as a stream
   * @param query - The query to match against
   * @returns Generator that emits batches of matching records
   */
  find?<RecordType = DataRecord, KeyType = DataKey>(
    ...query: any[]
  ): Generator<Map<KeyType, RecordType>, void, any>;
  batchSize?: number;

  /**
   * Validate a record against the schema
   * @param record - The record to validate
   * @throws Error if validation fails
   * @returns void if validation passes
   */
  validate<RecordType = DataRecord>(record: RecordType): void;
}

export interface CollSyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF {
  /**
   * Get the number of records in the collection
   * @returns The number of records
   */
  count(): number;

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   */
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => void,
  ): void;

  /**
   * Find records matching a query
   * The implementation of this method is sun-dependent
   * @param query - The query to match against
   * @param options - Optional parameters for the query
   * @returns A map of records matching the query or an Observable stream of records
   */
  find(...query: any[]): Generator<{ key: KeyType; value: RecordType }>;

  get(key: KeyType): RecordType | undefined;

  getAll(): Generator<{ key: KeyType; value: RecordType }>;

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

  send(key: KeyType, target: UniverseName): void;

  sendAll(props: SendProps<RecordType, KeyType>): TransportResult;

  sendMany(
    keys: KeyType[],
    props: SendProps<RecordType, KeyType>,
  ): TransportResult;

  set(key: KeyType, value: RecordType): void;

  setMany(values: Map<KeyType, RecordType>): void;

  /**
   * Delete a record by key
   * @param key The key of the record to delete
   */
  delete(key: KeyType): void;
}

export interface CollAsyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF {
  /**
   * Get the number of records in the collection
   * @returns A promise that resolves to the number of records
   */
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

  getAll(): Generator<Map<KeyType, RecordType>>;

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
}

export type CollName = string;
export type CollIF<RecordType = DataRecord, KeyType = DataKey> =
  | CollAsyncIF<RecordType, KeyType>
  | CollSyncIF<RecordType, KeyType>;
