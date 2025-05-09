import type {
  UnivCollSchemaMap,
  CollSchemaLocalIF,
  DataKey,
  DataRecord,
} from './type.schema';
import type { CollBaseIF, CollIF, CollName } from './types.coll';

export type UniverseName = string;

export interface SunIF<RecordType = DataRecord, KeyType = DataKey> {
  get(key: KeyType): RecordType | undefined;
  set(key: KeyType, value: RecordType): void;
  delete(key: KeyType): void;
  clear(): void;
  has(key: KeyType): boolean;
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
  baseCollSchemas?: UnivCollSchemaMap;

  transport(
    keyK: any,
    collectionName: string,
    fromU: UniverseName,
    toU: UniverseName,
  ): void;

  toLocal(record: any, coll: CollBaseIF): any; //convert record from a "multiversal" record to a collection
  toUniversal(record: any, coll: CollBaseIF): any; //convert record from a collection to a "multiversal" record
}

export * from './type.schema';
export * from './types.coll';
