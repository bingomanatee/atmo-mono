import type {
  CollIF,
  MultiverseIF,
  UniverseIF,
  UniverseName,
  DataRecord,
  DataKey,
} from './types.multiverse';
import type { CollName } from './types.coll';

export class Universe implements UniverseIF {
  name: UniverseName;
  #colls: Map<string, CollIF>;

  constructor(
    name: string,
    public multiverse?: MultiverseIF,
  ) {
    this.name = name;
    this.#colls = new Map();
    if (multiverse) {
      multiverse.add(this);
    }
  }

  add<RecordType = DataRecord, KeyType = DataKey>(
    coll: CollIF<RecordType, KeyType>,
  ): CollIF<RecordType, KeyType> {
    this.#colls.set(coll.name, coll as unknown as CollIF);
    return coll;
  }

  get(name: CollName) {
    return this.#colls.get(name);
  }

  has(name: CollName) {
    return this.#colls.has(name);
  }
}
