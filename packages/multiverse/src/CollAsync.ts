import type {
  CollAsyncIF,
  SchemaLocalIF,
  SunIF,
  UniverseIF,
  UniverseName,
} from './types.multiverse';
import sunMemoryAsyncF from './suns/SunMemoryAsync.ts';
import type { CollIF, CollSyncIF } from './types.coll';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: SchemaLocalIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIF<RecordType, KeyType>; // will default to memorySunF
};

export class CollAsync<RecordType, KeyType = string>
  implements CollAsyncIF<RecordType, KeyType>
{
  name: string;
  #universe: UniverseIF;
  schema: SchemaLocalIF;
  isAsync: true = true;

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, sunF, schema, universe } = params;
    this.name = name;
    this.schema = schema;
    this.#universe = universe;
    this.#engine = (sunF ?? sunMemoryAsyncF)(this);
    if (universe) {
      universe.add(this);
    }
  }

  #engine: SunIF<RecordType, KeyType>;

  async get(identity: KeyType) {
    return this.#engine.get(identity);
  }

  async has(key: KeyType) {
    return this.#engine.has(key);
  }

  async set(key: KeyType, value: RecordType) {
    this.#engine.set(key, value);
  }

  async send(key: KeyType, target: UniverseName) {
    if (!this.#universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.#universe.name,
      );
    }
    const multiverse = this.#universe.multiverse;
    return multiverse.transport(key, this.name, this.#universe.name, target);
  }
}
