import type {
  UnivCollSchemaMap,
  CollBaseIF,
  CollSchemaLocalFieldIF,
  DataRecord,
  MultiverseIF,
  UniverseIF,
  UniverseName,
} from './types.multiverse';
import { isObj } from './typeguards.multiverse';

// These helper functions are no longer needed with the simplified approach

export class Multiverse implements MultiverseIF {
  baseCollSchemas: UnivCollSchemaMap = new Map();
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

  toUniversal<ToRecord = DataRecord, fromRecord = DataRecord>(
    record: any,
    collection: CollBaseIF,
  ): ToRecord {
    // @ts-ignore
    const out: ToRecord = {};

    const map = this.universalizeLocalSchema(collection);

    for (const localName of Object.keys(map)) {
      const universalName = map[localName];
      // @ts-ignore
      out[universalName] = record[localName];
    }
    return out;
  }

  toLocal(record: any, coll: CollBaseIF): any {
    const out: Record<string, any> = {};
    const map = this.localizeUniversalSchema(coll);

    for (const univField of Object.keys(map)) {
      const localField = map[univField];
      out[localField] = record[univField];
    }

    return out;
  }
  /**
   * Maps local field names to their universal counterparts
   * @param collection The collection containing the schema
   * @returns A map of local field names to universal field names
   * -- the key ov the result is the universal field name
   * -- the value of the result is the local field name
   */
  localizeUniversalSchema(collection: CollBaseIF): Record<string, string> {
    const mappings: Record<string, string> = {};

    for (const fieldName in collection.schema.fields) {
      const fieldSchema = collection.schema.fields[fieldName];
      if (!isObj(fieldSchema)) {
        mappings[fieldName] = fieldName;
        continue;
      }
      const localField = fieldSchema as CollSchemaLocalFieldIF;

      if ('universalName' in localField) {
        mappings[localField.universalName!] = fieldName;
      } else {
        mappings[fieldName] = fieldName;
      }
    }

    return mappings;
  }

  /**
   * Maps universal field names to their local counterparts
   * @param collection The collection containing the schema
   * @returns A map of universal field names to local field names
   *  -- the key of the result is the local field name
   *  --- the value of the result is the universal field name
   */
  universalizeLocalSchema(collection: CollBaseIF): Record<string, string> {
    const mappings: Record<string, string> = {};

    for (const fieldName in collection.schema.fields) {
      const fieldSchema = collection.schema.fields[fieldName];
      if (!isObj(fieldSchema)) {
        mappings[fieldName] = fieldName;
        continue;
      }
      const localField = fieldSchema as CollSchemaLocalFieldIF;
      mappings[fieldName] =
        'universalName' in localField ? localField.universalName! : fieldName;
    }

    return mappings;
  }

  transport(
    key: any,
    collection: string,
    fromU: UniverseName,
    toU: UniverseName,
  ): void {
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

    const universal = this.toUniversal(record, fromColl as CollBaseIF);
    const localize = this.toLocal(universal, toColl);

    toColl.set(key, localize);
    return localize;
  }
}
