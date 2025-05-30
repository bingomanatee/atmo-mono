import type { Subscription } from 'rxjs';
import type { PartialObserver } from 'rxjs';
import type { DataKey, DataRecord, UnivSchemaMap } from './type.schema';
import type { CollBaseIF, CollIF, CollName } from './types.coll';

export type UniverseName = string;

export interface SunIF<RecordType = DataRecord, KeyType = DataKey> {
  /**
   * Initialize the sun. Must be called before any other operations.
   * This is where validation of the collection should occur.
   * @throws Error if initialization fails or if already initialized
   */
  init(): any; // void | Promise<void>

  // Use any for methods that differ between sync/async
  get(key: KeyType): any; // RecordType | undefined | Promise<RecordType | undefined>
  set(key: KeyType, value: RecordType): any; // void | Promise<void>
  has(key: KeyType): any; // boolean | Promise<boolean>
  delete(key: KeyType): any; // void | Promise<void>
  clear(): any; // void | Promise<void>
  values(): any; // Generator | AsyncGenerator
  find(query: string | ((record: RecordType) => boolean), value?: any): any; // Generator | AsyncGenerator
  findCount(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): any; // number | Promise<number>

  /**
   * Validate a record against the schema
   * @param record - The record to validate
   * @throws Error if validation fails
   * @returns void if validation passes
   */
  validate(record: RecordType): void;

  /**
   * Optional method to mutate a record
   * @param key - The key of the record to mutate
   * @param mutator - A function that accepts the previous record (or undefined) and returns a new record
   * @returns The mutated record or undefined if deleted
   */
  mutate?(key: KeyType, mutator: any): any; // RecordType | undefined | Promise<RecordType | undefined>

  keys?(): any; // KeyType[] | Promise<KeyType[]>
  each(callback: any): any; // void | Promise<void>
  count(): any; // number | Promise<number>
  map?(mapper: any, noTransaction?: boolean): any; // Map | Promise<Map>
  getMany?(keys: KeyType[]): any; // Generator | AsyncGenerator | Map | Promise<Map>
  setMany?(recordMap: Map<KeyType, RecordType>): any; // number | Promise<number>
  deleteMany?(keys: KeyType[]): any; // void | Promise<void>
  [Symbol.iterator](): any; // Iterator | AsyncIterator
}

export interface SunIFSync<RecordType = DataRecord, KeyType = DataKey>
  extends SunIF<RecordType, KeyType> {
  init(): void;

  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  has(key: KeyType): boolean;
  delete(key: KeyType): void;
  clear(): void;
  values(): Generator<[KeyType, RecordType]>;
  find(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): Generator<[KeyType, RecordType]>;
  findCount(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): number;
  mutate(
    key: KeyType,
    mutator: MutatorSync<RecordType, KeyType>,
  ): RecordType | undefined;

  keys?(): KeyType[];

  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => void,
  ): any;
  /**
   * Get the number of records in the collection
   * @returns The number of records for sync collections, Promise<number> for async collections
   */
  count(): any;
  map?(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ): any;

  /**
   * Get multiple records as a generator of [key, value] pairs
   * @param keys Array of record keys to get
   * @returns A generator of [key, value] pairs for matching records
   */
  getMany(keys: KeyType[]): Generator<[KeyType, RecordType]>;

  /**
   * Delete multiple records by their keys
   * @param keys Array of record keys to delete
   */
  deleteMany?(keys: KeyType[]): void;

  /**
   * Optional method to get all keys in the collection
   * @returns An array of keys
   */
  keys?(): KeyType[] | Promise<KeyType[]>;

  [Symbol.iterator](): Iterator<[KeyType, RecordType]>;
}

export interface SunIfAsync<RecordType = DataRecord, KeyType = DataKey>
  extends SunIF<RecordType, KeyType> {
  init(): Promise<void>;

  get(key: KeyType): Promise<RecordType | undefined>;
  set(key: KeyType, value: RecordType): Promise<void>;
  has(key: KeyType): Promise<boolean>;
  delete(key: KeyType): Promise<void>;
  clear(): Promise<void>;
  values(): AsyncGenerator<[KeyType, RecordType]>;
  find(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): AsyncGenerator<[KeyType, RecordType]>;
  findCount(
    query: string | ((record: RecordType) => boolean),
    value?: any,
  ): Promise<number>;
  mutate(
    key: KeyType,
    mutator: MutatorAsync<RecordType, KeyType>,
  ): Promise<RecordType | undefined>;

  /**
   * Get the number of records in the collection
   * @returns The number of records for sync collections, Promise<number> for async collections
   */
  count(): number | Promise<number>;

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   * @returns void for sync collections, Promise<void> for async collections
   */
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => void,
  ): Promise<void>;

  getMany(keys: KeyType[]): Generator<[KeyType, RecordType]>;

  /**
   * Delete multiple records by their keys
   * @param keys Array of record keys to delete
   */
  deleteMany?(keys: KeyType[]): Promise<void>;

  /**
   * Optional method to get all keys in the collection
   * @returns An array of keys
   */
  keys?(): KeyType[] | Promise<KeyType[]>;

  map?(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ): Promise<Map<KeyType, RecordType>>;

  [Symbol.iterator](): Iterator<[KeyType, RecordType]>;
}

export interface UniverseIF {
  name: UniverseName;
  get(name: CollName): CollIF | undefined;
  has(name: CollName): boolean;
  add<RecordType = DataRecord, KeyType = DataKey>(
    coll: CollIF<RecordType, KeyType>,
  ): CollIF<RecordType, KeyType>;
  multiverse?: MultiverseIF;
}

// but with "variations" in each universe.
export interface MultiverseIF {
  has(name: UniverseName): boolean;
  get(name: UniverseName): UniverseIF | undefined;
  add(u: UniverseIF): UniverseIF;
  baseSchemas: UnivSchemaMap;

  transport<RecordType = DataRecord, KeyType = any>(
    keyK: any,
    props: TransportProps<RecordType, KeyType>,
  ): void | Promise<void>;
  localToUnivFieldMap(
    collection: CollBaseIF,
    univName: string,
  ): Record<string, string>;
  univToLocalFieldMap(
    collection: CollBaseIF,
    univName: string,
  ): Record<string, string>;
  toLocal(record: any, coll: CollBaseIF, uName: string): any; //convert record from a "multiversal" record to a collection
  toUniversal<
    ToRecord extends object = DataRecord,
    KeyType extends DataKey = any,
  >(
    record: any,
    coll: CollBaseIF,
    uName: string,
    key: KeyType,
  ): ToRecord; //convert record from a collection to a "multiversal" record
  transportGenerator<RecordType = DataRecord, KeyType extends DataKey = any>(
    props: TransportProps<RecordType, KeyType>,
  ): Subscription;
}

type Listener<T> = PartialObserver<T> | ((value: T) => void);

export type TransportProps<RecordType, KeyType> = {
  generator:
    | Generator<Map<KeyType, RecordType>>
    | AsyncGenerator<Map<KeyType, RecordType>>;
  collectionName: string;
  fromU: UniverseName;
  toU: UniverseName;
  listener?: Listener<StreamMsg>;
};

export type TransportResult =
  | Subscription
  | undefined
  | Promise<Subscription | undefined>;

export type SendProps<RecordType, KeyType> = Omit<
  TransportProps<RecordType, KeyType>,
  'generator'
>;
export type StreamMsg = {
  current?: number;
  total?: number;
  error?: Error;
};
export * from './type.schema';
export * from './types.coll';

// Import types needed for mutator definitions
import type { CollSyncIF, CollAsyncIF } from './types.coll';

/**
 * Interface for mutation action results
 */
export interface MutationAction {
  /** The action to perform */
  action: symbol;
  /** Optional key for the record (required for DELETE) */
  key?: any;
  /** Optional value for the action */
  value?: any;
}

// Separate mutator types for sync and async operations
export type MutatorSync<RecordType, KeyType> = (
  draft: RecordType | undefined,
  collection: CollSyncIF<RecordType, KeyType>,
) => MutationAction | RecordType | undefined;

export type MutatorAsync<RecordType, KeyType> = (
  draft: RecordType | undefined,
  collection: CollAsyncIF<RecordType, KeyType>,
) => Promise<MutationAction | RecordType | undefined>;
