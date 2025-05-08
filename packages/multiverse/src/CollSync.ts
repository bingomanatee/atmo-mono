import type {
  CollBaseIF,
  SunIF,
  UniverseIF,
  UniverseName,
} from './types.multiverse';
import memorySunF from './suns/MemorySunF';
import type { CollSchemaIF } from './type.schema';
import type { CollIF, CollSyncIF } from './types.coll';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: CollSchemaIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIF<RecordType, KeyType>; // will default to memorySunF
};

export class CollSync<RecordType, KeyType = string>
  implements CollSyncIF<RecordType, KeyType>
{
  name: string;
  #universe: UniverseIF;
  schema: CollSchemaIF;
  isAsync: false = false;

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    this.name = name;
    this.schema = schema;
    this.#universe = universe;
    this.#engine = (sunF ?? memorySunF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  #engine: SunIF<RecordType, KeyType>;

  get(identity: KeyType): RecordType | undefined {
    return this.#engine.get(identity);
  }

  has(key: KeyType): boolean {
    return this.#engine.has(key);
  }

  set(key: KeyType, value: RecordType): void {
    this.#engine.set(key, value);
  }

  send(key: KeyType, target: UniverseName): void {
    if (!this.#universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.#universe.name,
      );
    }
    const multiverse = this.#universe.multiverse;
    if (!this.has(key)) throw new Error(this.name + 'does not have key ' + key);
    const record = this.get(key);
    const universal = multiverse.toUniversal(record, this as CollBaseIF);
    this.#universe.multiverse.send(key, universal, target);
  }
}
