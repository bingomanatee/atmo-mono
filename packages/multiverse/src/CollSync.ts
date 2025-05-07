import type {
  CollEngineIF,
  CollIF,
  CollIFSync,
  CollSchema,
} from './types.multiverse';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: CollSchema;
  engineF: (
    coll: CollIF<RecordType, KeyType>,
  ) => CollEngineIF<RecordType, KeyType>;
};
export class CollSync<RecordType, KeyType = string> implements CollIFSync {
  name: string;
  schema: CollSchema;
  isAsync: false = false;

  constructor(params: CollParms<RecordType, KeyType>) {
    const { name, engineF, schema } = params;
    this.name = name;
    this.schema = schema;
    this.#engine = engineF(this);
  }

  #engine: CollEngineIF<RecordType, KeyType>;

  get(identity: KeyType): RecordType {
    return this.#engine.get(identity);
  }

  has(key: KeyType): boolean {
    return this.#engine.has(key);
  }
}
