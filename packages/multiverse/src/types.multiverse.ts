import type { Subscription } from 'rxjs';
import type { PartialObserver } from 'rxjs';
import type { DataKey, DataRecord, UnivSchemaMap } from './type.schema';
import type { CollBaseIF, CollIF, CollName } from './types.coll';

export type UniverseName = string;

export interface SunIF<RecordType = DataRecord, KeyType = DataKey> {
  get(key: KeyType): any;
  set(key: KeyType, value: RecordType): any;
  getAll(): any;
  delete(key: KeyType): any;
  clear(): any;
  has(key: KeyType): any;
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
  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns A generator of {key, value} pairs for matching records
   */
  find?(query: any): Generator<{ key: KeyType; value: RecordType }>;

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
   * Get multiple records as a generator of {key, value} pairs
   * @param keys Array of record keys to get
   * @returns A generator of {key, value} pairs for matching records
   */
  getMany?(keys: KeyType[]): Generator<{ key: KeyType; value: RecordType }>;

  /**
   * Get all records as a generator of {key, value} pairs
   * @returns A generator of {key, value} pairs for all records
   */
  getAll():
    | Generator<{ key: KeyType; value: RecordType }>
    | Promise<Generator<{ key: KeyType; value: RecordType }>>;

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany?(recordMap: Map<KeyType, RecordType>): number | Promise<number>;
}
export interface SunIFSync<RecordType = DataRecord, KeyType = DataKey>
  extends SunIF<RecordType, KeyType> {
  get(key: KeyType): RecordType | undefined;
  getAll(): Generator<{ key: KeyType; value: RecordType }>;
  set(key: KeyType, value: RecordType): void;
  delete(key: KeyType): void;
  clear(): void;
  has(key: KeyType): boolean;
  validate(record: RecordType): void;
  /**
   * Optional method to mutate a record
   * @param key - The key of the record to mutate
   * @param mutator - A function that accepts the previous record (or undefined) and returns a new record
   * @returns The mutated record or undefined if deleted
   */
  mutate?(
    key: KeyType,
    mutator: (draft: RecordType | undefined) => RecordType | void | any,
  ): RecordType;
  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns A generator of {key, value} pairs for matching records
   */
  find?(query: any): Generator<{ key: KeyType; value: RecordType }>;
  /**
   * Optional method to get all keys in the collection
   * @returns An array of keys
   */
  keys?(): KeyType[];
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
  ): void | Promise<void>;
  count(): number | Promise<number>;
  map?(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollBaseIF,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ): Map<KeyType, RecordType> | Promise<Map<KeyType, RecordType>>;
}

export interface SunIfAsync<RecordType = DataRecord, KeyType = DataKey>
  extends SunIF {
  clear(): Promise<void>;
  validate(record: RecordType): void;

  /**
   * Get the number of records in the collection
   * @returns The number of records for sync collections, Promise<number> for async collections
   */
  count(): number | Promise<number>;

  delete(key: KeyType): Promise<void>;

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
  ): void | Promise<void>;

  /**
   * Optional method to find records matching a query
   * @param query - The query to match against
   * @returns An array of records matching the query
   */
  find?(...query: any[]): RecordType[] | Promise<Map<KeyType, RecordType>>;

  get(key: KeyType): Promise<RecordType | undefined>;

  getMany(keys: KeyType[]): AsyncGenerator<Map<KeyType, RecordType>>;
  getAll(): AsyncGenerator<{ key: KeyType; value: RecordType }>;

  has(key: KeyType): Promise<boolean>;

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
  ): Map<KeyType, RecordType> | Promise<Map<KeyType, RecordType>>;

  mutate?(
    key: KeyType,
    mutator: (draft: RecordType | undefined) => RecordType | void | any,
  ): Promise<RecordType>;

  set(key: KeyType, value: RecordType): Promise<void>;
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
  toUniversal(record: any, coll: CollBaseIF, uName: string): any; //convert record from a collection to a "multiversal" record
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
