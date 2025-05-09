import type {
  CollAsyncIF,
  CollBaseIF,
  SchemaLocalFieldIF,
  DataRecord,
  MultiverseIF,
  UnivSchemaMap,
  UniverseIF,
  UniverseName,
} from './types.multiverse';
import { isObj } from './typeguards.multiverse';

// These helper functions are no longer needed with the simplified approach

export class Multiverse implements MultiverseIF {
  baseSchemas: UnivSchemaMap = new Map();
  #universes: Map<string, any> = new Map();

  has(name: string) {
    return this.#universes.has(name);
  }

  get(name: UniverseName): UniverseIF | undefined {
    return this.#universes.get(name);
  }

  add(u: UniverseIF, replace = false) {
    if (!replace && this.#universes.has(u.name)) {
      throw new Error(`Universe ${u.name} already exists`);
    }
    this.#universes.set(u.name, u);
    return u;
  }

  toUniversal<ToRecord = DataRecord>(
    record: any,
    collection: CollBaseIF,
    fromUnivName: string,
  ): ToRecord {
    // @ts-ignore
    const out: ToRecord = {};

    const map = this.universalizeLocalSchema(collection, fromUnivName);

    for (const localName of Object.keys(map)) {
      const universalName = map[localName];
      // @ts-ignore
      out[universalName] = record[localName];
    }
    return out;
  }

  toLocal(record: any, coll: CollBaseIF, univName: string): any {
    const out: Record<string, any> = {};
    const map = this.localizeUniversalSchema(coll, univName);

    for (const univField of Object.keys(map)) {
      const localField = map[univField];
      out[localField] = record[univField];
    }

    return out;
  }

  /**
   * Maps local field names to their universal counterparts
   * @param collection The collection containing the schema
   * @param univName The name of the universe
   * @returns A map of local field names to universal field names
   * -- the key ov the result is the universal field name
   * -- the value of the result is the local field name
   */
  localizeUniversalSchema(
    collection: CollBaseIF,
    univName: string,
  ): Record<string, string> {
    if (!univName) throw new Error('must know univ name');
    const collKey = `${collection.name}\t${univName}`;

    if (this.#localToUnivCache.has(collKey)) {
      return this.#localToUnivCache.get(collKey)!;
    }
    const mappings: Record<string, string> = {};

    for (const fieldName in collection.schema.fields) {
      const fieldSchema = collection.schema.fields[fieldName];
      if (!isObj(fieldSchema)) {
        mappings[fieldName] = fieldName;
        continue;
      }
      const localField = fieldSchema as SchemaLocalFieldIF;

      if ('universalName' in localField) {
        mappings[localField.universalName!] = fieldName;
      } else {
        mappings[fieldName] = fieldName;
      }
    }

    this.#localToUnivCache.set(collKey, mappings);
    return mappings;
  }

  #localToUnivCache: Map<string, Record<string, string>> = new Map();

  /**
   * Maps universal field names to their local counterparts
   * @param collection The collection containing the schema
   * @returns A map of universal field names to local field names
   *  -- the key of the result is the local field name
   *  --- the value of the result is the universal field name
   */
  universalizeLocalSchema(
    collection: CollBaseIF,
    univName: string,
  ): Record<string, string> {
    const collKey = `${collection.name}\t${univName}`;
    if (this.#univToLocalCache.has(collKey)) {
      return this.#univToLocalCache.get(collKey)!;
    }

    const mappings: Record<string, string> = {};

    for (const fieldName in collection.schema.fields) {
      const fieldSchema = collection.schema.fields[fieldName];

      const localField = fieldSchema as SchemaLocalFieldIF;
      mappings[fieldName] =
        'universalName' in localField ? localField.universalName! : fieldName;
    }

    this.#univToLocalCache.set(collKey, mappings);
    return mappings;
  }

  #univToLocalCache: Map<string, Record<string, string>> = new Map();

  transport(
    key: any,
    collection: string,
    fromU: UniverseName,
    toU: UniverseName,
  ): void | Promise<void> {
    const fromColl = this.get(fromU)?.get(collection);
    if (!fromColl) {
      throw new Error(
        `Collection ${collection} not found in universe ${fromU}`,
      );
    }

    const toColl = this.get(toU)?.get(collection);
    if (!toColl) {
      throw new Error(`Collection ${collection} not found in universe ${toU}`);
    }

    const record = fromColl.get(key);

    if (!record) {
      console.warn('cannot find ' + key + ' in ' + collection + ' in ' + fromU);
      return;
    }

    const universal = this.toUniversal(record, fromColl as CollBaseIF, fromU);

    const localize = this.toLocal(universal, toColl as CollBaseIF, toU);
    if (toColl.isAsync) {
      const asyncColl: CollAsyncIF = toColl as CollAsyncIF;
      return asyncColl.set(key, localize);
    }
    toColl.set(key, localize);
    return localize;
  }
}
