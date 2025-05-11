import type {
  UnivSchemaMap,
  DataKey,
  DataRecord,
  SchemaLocalIF,
} from './type.schema';
import type { CollBaseIF, CollIF, CollName } from './types.coll';

export type UniverseName = string;

export interface SunIF<RecordType = DataRecord, KeyType = DataKey> {
  get(key: KeyType): any;
  set(key: KeyType, value: RecordType): any;
  delete(key: KeyType): any;
  clear(): any;
  has(key: KeyType): any;
  /**
   * Optional method to mutate a record
   * @param key - The key of the record to mutate
   * @param mutator - A function that accepts the previous record (or undefined) and returns a new record
   * @returns The mutated record or undefined if deleted
   */
  mutate?(
    key: KeyType,
    mutator: (draft: RecordType | undefined) => RecordType | void | any,
  ): any;
  /**
   * Optional method to find records matching a query
   * @param query - The query to match against
   * @returns An array of records matching the query
   */
  find?(query: any): RecordType[] | Promise<RecordType[]>;
  /**
   * Optional method to get all keys in the collection
   * @returns An array of keys
   */
  keys?(): KeyType[] | Promise<KeyType[]>;
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
   * Get the number of records in the collection
   * @returns The number of records for sync collections, Promise<number> for async collections
   */
  count(): number | Promise<number>;
  /**
   * Map over each record in the collection and apply a transformation
   * @param mapper - Function to transform each record
   * @param noTransaction - If true, changes are applied immediately without transaction support
   * @returns The number of records processed for sync collections, Promise<number> for async collections
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  map?(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollBaseIF,
    ) => RecordType | void | any,
    noTransaction?: boolean,
  ): Map<KeyType, RecordType> | Promise<Map<KeyType, RecordType>>;
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

  transport(
    keyK: any,
    collectionName: string,
    fromU: UniverseName,
    toU: UniverseName,
  ): void | Promise<void>;
  localToUnivFieldMap(coll: CollIF): Record<string, string>;
  univToLocalFieldMap(coll: CollIF): Record<string, string>;
  toLocal(record: any, coll: CollBaseIF, uName: string): any; //convert record from a "multiversal" record to a collection
  toUniversal(record: any, coll: CollBaseIF, uName: string): any; //convert record from a collection to a "multiversal" record
}

export * from './type.schema';
export * from './types.coll';
