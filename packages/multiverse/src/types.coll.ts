// a system has a collection of uniform records
import type { SchemaLocalIF, DataKey, DataRecord } from './type.schema';
import type { UniverseName } from './types.multiverse';

// ------------------- collection nodes -------------------

export interface CollBaseIF {
  name: CollName;
  schema: SchemaLocalIF;
}

export interface CollSyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF {
  name: CollName;
  schema: SchemaLocalIF;

  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  has(key: KeyType): boolean;
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
  ): RecordType | undefined;
  send(key: KeyType, target: UniverseName): void;
  /**
   * Find records matching a query
   * The implementation of this method is engine-dependent
   * @param query - The query to match against
   * @returns An array of records matching the query
   */
  find(query: any): RecordType[];
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
   * Get the number of records in the collection
   * @returns The number of records
   */
  count(): number;
  /**
   * Map over each record in the collection and apply a transformation
   * @param mapper - Function to transform each record
   * @param noTransaction - If true, changes are applied immediately without transaction support
   * @returns The number of records processed
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ): number;
  isAsync: false;
}

export interface CollAsyncIF<RecordType = DataRecord, KeyType = DataKey>
  extends CollBaseIF {
  isAsync: true;
  get(key: KeyType): Promise<RecordType | undefined>;
  set(key: KeyType, value: RecordType): Promise<void>;
  has(key: KeyType): Promise<boolean>;
  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => RecordType | void | any | Promise<RecordType | void | any>,
  ): Promise<RecordType | undefined>;
  send(key: KeyType, target: UniverseName): Promise<void>;
  /**
   * Find records matching a query
   * The implementation of this method is engine-dependent
   * @param query - The query to match against
   * @returns A promise that resolves to an array of records matching the query
   */
  find(query: any): Promise<RecordType[]>;
  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   * @returns A promise that resolves when all callbacks have been called
   */
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => void | Promise<void>,
  ): Promise<void>;
  /**
   * Get the number of records in the collection
   * @returns A promise that resolves to the number of records
   */
  count(): Promise<number>;
  /**
   * Map over each record in the collection and apply a transformation
   * @param mapper - Function to transform each record
   * @param noTransaction - If true, changes are applied immediately without transaction support
   * @returns A promise that resolves to the number of records processed
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollAsyncIF<RecordType, KeyType>,
    ) => RecordType | void | any | Promise<RecordType | void | any>,
  ): Promise<Map<KeyType, RecordType>>;
}

export type CollName = string;
export type CollIF<RecordType = DataRecord, KeyType = DataKey> =
  | CollAsyncIF<RecordType, KeyType>
  | CollSyncIF<RecordType, KeyType>;
