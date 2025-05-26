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
  init(): void | Promise<void>;

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
  mutate?(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
    ) => Promise<RecordType | MutationAction>,
  ): any;

  keys?(): any;

  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollBaseIF,
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
      collection: CollBaseIF,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ): any;

  /**
   * Get multiple records as a generator of [key, value] pairs
   * @param keys Array of record keys to get
   * @returns A generator of [key, value] pairs for matching records
   */
  getMany?(keys: KeyType[]): Generator<[KeyType, RecordType]>;

  /**
   * Get all records as a generator of [key, value] pairs
   * @returns A generator of [key, value] pairs for all records
   */
  getAll():
    | Generator<[KeyType, RecordType]>
    | Promise<Generator<[KeyType, RecordType]>>;

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany?(recordMap: Map<KeyType, RecordType>): number | Promise<number>;

  /**
   * Make the Sun engine itself iterable over [key, value] pairs
   */
  [Symbol.iterator](): Iterator<[KeyType, RecordType]>;
}

export interface SunIFSync<RecordType = DataRecord, KeyType = DataKey>
  extends SunIF<RecordType, KeyType> {
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
    ) => RecordType | undefined | MutationAction,
  ): RecordType | undefined;
}

export interface SunIfAsync<RecordType = DataRecord, KeyType = DataKey>
  extends Omit<SunIF<RecordType, KeyType>, 'init'> {
  /**
   * Initialize the sun. Must be called before any other operations.
   * This is where validation of the collection should occur.
   * @throws Error if initialization fails or if already initialized
   */
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
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
    ) => Promise<RecordType | undefined | MutationAction>,
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
      collection: CollBaseIF,
    ) => void,
  ): Promise<void>;

  /**
   * Optional method to find records matching a query
   * @param query - The query to match against
   * @returns A generator of [key, value] pairs for matching records
   */
  find?(...query: any[]): AsyncGenerator<[KeyType, RecordType]>;

  getMany(keys: KeyType[]): AsyncGenerator<[KeyType, RecordType]>;
  getAll(): AsyncGenerator<[KeyType, RecordType]>;

  /**
   * Optional method to get all keys in the collection
   * @returns An array of keys
   */
  keys?(): KeyType[] | Promise<KeyType[]>;

  map?(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollBaseIF,
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
  toUniversal(record: any, coll: CollBaseIF, uName: string, key: KeyType): any; //convert record from a collection to a "multiversal" record
  transportGenerator<RecordType = DataRecord, KeyType = any>(
    props: TransportProps<KeyType, RecordType>,
  ): TransportResult;
}

type Listener<T> = PartialObserver<T> | ((value: T) => void);

export type TransportProps<KeyType, RecordType> = {
  generator: Generator<Map<KeyType, RecordType>>;
  collectionName: string;
  fromU: UniverseName;
  toU: UniverseName;
  listener?: Listener<StreamMsg>;
};

export type TransportResult = Subscription | undefined;

export type SendProps<R, K> = Omit<TransportProps<R, K>, 'generator'>;
export type StreamMsg = {
  current?: number;
  total?: number;
  error?: Error;
};
export * from './type.schema';
export * from './types.coll';

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
