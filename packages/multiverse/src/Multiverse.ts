import type {
  CollAsyncIF,
  CollBaseIF,
  DataRecord,
  MultiverseIF,
  FieldLocalIF,
  UniverseIF,
  UniverseName,
  UnivSchemaMap,
} from './types.multiverse';
import { isObj } from './typeguards.multiverse';

// These helper functions are no longer needed with the simplified approach

export class Multiverse implements MultiverseIF {
  #universes: Map<string, any> = new Map();

  constructor(public baseSchemas: UnivSchemaMap = new Map()) {}

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

    const map = this.localToUnivFieldMap(collection, fromUnivName);

    for (const localName of Object.keys(map)) {
      const universalName = map[localName];
      // @ts-ignore
      out[universalName] = record[localName];
    }
    return out;
  }

  toLocal(record: any, coll: CollBaseIF, univName: string): any {
    const out: Record<string, any> = {};
    const map = this.univToLocalFieldMap(coll, univName);

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
  localToUnivFieldMap(
    collection: CollBaseIF,
    univName: string,
  ): Record<string, string> {
    if (!univName) throw new Error('must know univ name');
    if (!collection.name) throw new Error('toLocal: coll must have a name');

    const collKey = `${collection.name}\t${univName}`;

    if (this.#localToUnivCache.has(collKey)) {
      return this.#localToUnivCache.get(collKey)!;
    }
    const mappings: Record<string, string> = {};

    const univSchema = this.baseSchemas.get(collection.name);
    if (!univSchema) {
      throw new Error(
        'cannot find universal schema for collection ' + collection.name,
      );
    }
    for (const universalName of Object.keys(univSchema.fields)) {
      const collectionField = (Array.from(
        Object.values(collection.schema.fields),
      ).find((f) => f.universalName == universalName) ??
        collection.schema.fields[universalName]) as FieldLocalIF;

      if (!collectionField) {
        console.error(
          'cannot find ',
          universalName,
          'in',
          JSON.stringify(collection.schema),
        );
        throw new Error(
          `collection ${collection.name} does not have an equivalent field for universal field ${universalName}`,
        );
      }
      if (!collectionField.name) {
        console.error('no name in ', collectionField);
        throw new Error('bad schema');
      }
      mappings[collectionField.name] = universalName;
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
  univToLocalFieldMap(
    collection: CollBaseIF,
    univName: string,
  ): Record<string, string> {
    if (!collection.name)
      throw new Error('collections must have name -- univToLocalFieldMap');

    const universalSchema = this.baseSchemas.get(collection.name);

    if (!universalSchema) {
      throw new Error(
        'universal schema for ' + collection.name + ' is not defined',
      );
    }

    const collKey = `${collection.name}\t${univName}`;
    if (this.#univToLocalCache.has(collKey)) {
      return this.#univToLocalCache.get(collKey)!;
    }

    const mappings: Record<string, string> = {};

    if (!universalSchema.fields) {
      console.log('no fields in ', universalSchema);
    }
    for (const universalFieldName of Object.keys(universalSchema.fields)) {
      const localFieldDef =
        Array.from(Object.values(collection.schema.fields)).find((field) => {
          return field.universalName === universalFieldName;
        }) ?? collection.schema.fields[universalFieldName];
      const universalFieldDef = universalSchema.fields[universalFieldName];

      if (!localFieldDef) {
        if (universalFieldDef.meta?.defaultValue) {
          mappings[universalFieldName] = universalFieldDef.meta.defaultValue;
          continue;
        }
        console.error(
          'univToLocalFieldMap: cannot make map from ',
          collection.schema.fields,
          'to universal schema',
          universalSchema.fields,
        );
        throw new Error(
          `universalizeLocalSchema: ${universalFieldName} not present in local schema and no default value supplied to universal schema `,
        );
      }

      mappings[universalFieldName] = localFieldDef.name;
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
    if (!this.baseSchemas.has(collection)) {
      throw new Error(
        `cannot transport collections without a universal schema definition: ${collection}`,
      );
    }
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
      console.warn(`cannot find ${key} in ${collection} in ${fromU}`);
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
