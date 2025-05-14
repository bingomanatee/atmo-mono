import { asError } from '@wonderlandlabs/atmo-utils';
import { get, set } from 'lodash-es';
import { Subject, Subscription } from 'rxjs';
import type {
  CollBaseIF,
  DataRecord,
  FieldLocalIF,
  MultiverseIF,
  StreamMsg,
  TransportProps,
  UniverseIF,
  UniverseName,
  UnivSchemaMap,
} from './types.multiverse';

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

    // Get the existing record if possible (for currentValue)
    let existingRecord: any = undefined;
    if (record && record.id) {
      try {
        existingRecord = collection.get(record.id);
      } catch (e) {
        // If we can't get the existing record, that's okay
        // We'll just use undefined for currentValue
      }
    }

    const map = this.localToUnivFieldMap(collection, fromUnivName);

    for (const localName of Object.keys(map)) {
      const universalName = map[localName];
      const fieldDef = collection.schema.fields[localName] as FieldLocalIF;

      // Throw an error if the field definition is not present
      if (!fieldDef) {
        throw new Error(
          `Field definition for '${localName}' not found in schema for collection '${collection.name}'`,
        );
      }

      // Use lodash get to support nested paths like 'position.x'
      // @ts-ignore
      out[universalName] = get(record, localName);

      // Apply export function if it exists
      if (fieldDef.export) {
        // @ts-ignore
        out[universalName] = fieldDef.export({
          currentRecord: existingRecord,
          univName: fromUnivName,
          inputRecord: record,
          currentValue: existingRecord
            ? get(existingRecord, localName)
            : undefined,
          newValue: get(record, localName),
          field: fieldDef,
        });
      }
    }

    // Process exportOnly fields - these are fields that are only used during toUniversal conversion
    // They might not exist in the record but can be generated via filters
    for (const fieldName of Object.keys(collection.schema.fields)) {
      const fieldDef = collection.schema.fields[fieldName] as FieldLocalIF;

      // Throw an error if the field definition is not present
      if (!fieldDef) {
        throw new Error(
          `Field definition for '${fieldName}' not found in schema for collection '${collection.name}'`,
        );
      }

      // Process exportOnly fields
      if (fieldDef.exportOnly && fieldDef.universalName) {
        if (fieldDef.export) {
          // If there's an export function, use it to generate the value
          // @ts-ignore
          out[fieldDef.universalName] = fieldDef.export({
            currentRecord: existingRecord,
            univName: fromUnivName,
            inputRecord: record,
            currentValue: existingRecord
              ? get(existingRecord, fieldName)
              : undefined,
            newValue: get(record, fieldName),
            field: fieldDef,
          });
        } else {
          // If there's no export function, use lodash get to access the value using the field name
          // This allows for dot notation paths like 'position.x'
          // @ts-ignore
          out[fieldDef.universalName] = get(record, fieldName);
        }
      }
    }

    return out;
  }

  toLocal(record: any, coll: CollBaseIF, univName: string): any {
    const out: Record<string, any> = {};
    const map = this.univToLocalFieldMap(coll, univName);

    for (const univField of Object.keys(map)) {
      const localField = map[univField];

      // Get the field definition using the local field name
      const fieldDef = coll.schema.fields[localField] as FieldLocalIF;

      // Throw an error if the field definition is not present
      if (!fieldDef) {
        throw new Error(
          `Field definition for local field '${localField}' (mapped from universal field '${univField}') not found in schema for collection '${coll.name}'`,
        );
      }

      // Skip exportOnly fields when converting from universal to local
      if (fieldDef.exportOnly) {
        continue; // Skip exportOnly fields when converting to local
      }

      // Use lodash get to support nested paths
      const value = get(record, univField);

      // Use lodash set to support nested paths in the output object
      if (localField.includes('.')) {
        set(out, localField, value);
      } else {
        out[localField] = value;
      }
    }

    return out;
  }

  #localToUnivCache: Map<string, Record<string, string>> = new Map();

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

  #univToLocalCache: Map<string, Record<string, string>> = new Map();

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
      // Find a field with matching universalName
      const localFieldDef =
        Array.from(Object.values(collection.schema.fields)).find((field) => {
          // If universalName is specified, use it for matching
          if (field.universalName) {
            return field.universalName === universalFieldName;
          }
          // If no universalName is specified, use the field's name as the default
          return field.name === universalFieldName;
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

  async #transportAsync<RecordType = DataRecord, KeyType = any>(
    key: any,
    props: TransportProps<RecordType, KeyType>,
  ) {
    const { collectionName: collection, fromU, toU } = props;
    const { fromColl, toColl } = this.#initTransport<RecordType, KeyType>(
      props,
    );

    const record = await fromColl.get(key);

    if (!record) {
      console.warn(`cannot find ${key} in ${collection} in ${fromU}`);
      return;
    }

    const localize = this.#translateRecord(record, props);
    return toColl.set(key, localize);
  }

  transport<RecordType = DataRecord, KeyType = any>(
    key: any,
    props: Omit<TransportProps<RecordType, KeyType>, 'generator'>,
  ): void | Promise<void> {
    const { collectionName: collection, fromU, toU } = props;
    const { fromColl, toColl } = this.#initTransport<RecordType, KeyType>(
      props,
    );

    if (fromColl.isAsync || toColl.isAsync)
      return this.#transportAsync(key, props);
    const record = fromColl.get(key);

    if (!record) {
      console.warn(`cannot find ${key} in ${collection} in ${fromU}`);
      return;
    }

    const localize = this.#translateRecord(record, props);
    return toColl.set(key, localize);
  }

  #translateRecord<RecordType = DataRecord, KeyType = any>(
    value: RecordType,
    props: TransportProps<RecordType, KeyType>,
  ): any {
    const { fromU, toU, collectionName } = props;
    const { fromColl, toColl } = this.#initTransport<RecordType, KeyType>(
      props,
    );

    // Convert to universal format
    const universalRecord = this.toUniversal(
      value,
      fromColl as CollBaseIF,
      fromU,
    );

    const out = this.toLocal(universalRecord, toColl as CollBaseIF, toU);
    return out;
  }

  #initTransport<RecordType = DataRecord, KeyType = any>(
    props: TransportProps<RecordType, KeyType>,
  ) {
    const { collectionName, fromU, toU } = props;

    if (!this.baseSchemas.has(collectionName)) {
      throw new Error(
        `cannot transport collections without a universal schema definition: ${collectionName}`,
      );
    }
    const fromColl = this.get(fromU)?.get(collectionName);
    if (!fromColl) {
      throw new Error(
        `Collection ${collectionName} not found in universe ${fromU}`,
      );
    }

    const toColl = this.get(toU)?.get(collectionName);
    if (!toColl) {
      throw new Error(
        `Collection ${collectionName} not found in universe ${toU}`,
      );
    }
    if (!this.baseSchemas.has(collectionName)) {
      throw new Error(
        `cannot transport collections without a universal schema definition: ${collection}`,
      );
    }

    return { fromColl, toColl };
  }

  #transportGeneratorAsync<RecordType = DataRecord, KeyType = any>(
    props: TransportProps<RecordType, KeyType>,
  ) {
    const feedbackStream: Subject<StreamMsg> = new Subject();
    const { listener, generator } = props;

    const { toColl } = this.#initTransport<RecordType, KeyType>(props);
    let subscription = listener ? feedbackStream.subscribe(listener) : null;
    let data: IteratorResult<Map<KeyType, RecordType>>;
    let outBatchSize = toColl.batchSize ?? 30;

    let outMap = new Map();
    let total = 0;
    let pending = 0;

    const flushInner = async (
      map: Map<KeyType, RecordType>,
      always = false,
    ) => {
      if (map.size <= 0) return false;
      if (!always && (outBatchSize <= 0 || map.size < outBatchSize))
        return false;
      try {
        await toColl.setMany(map);
        total += map.size;
        feedbackStream.next({
          total,
          current: map.size,
        });
      } catch (error) {
        feedbackStream.error(error);
      } finally {
        pending -= 1;
        if (always && pending <= 0) {
          feedbackStream.complete();
        }
      }
    };
    const flush = (always = false) => {
      pending += 1;
      flushInner(outMap, always); // NOT waiting for async result
      outMap = new Map();
    };

    do {
      data = generator.next();
      if (data.done) break;
      const dataMap = data.value;

      for (const [key, value] of dataMap) {
        if (value) {
          const targetRecord = this.#translateRecord(value, props);
          outMap.set(key, targetRecord);
          flush();
        } // if value
      } // for
    } while (!data?.done);

    flush(true);
    return subscription;
  }

  transportGenerator<RecordType = DataRecord, KeyType = any>(
    props: TransportProps<RecordType, KeyType>,
  ): Subscription {
    const feedbackStream: Subject<StreamMsg> = new Subject();

    const { fromColl, toColl } = this.#initTransport<RecordType, KeyType>(
      props,
    );
    if (toColl.isAsync) return this.#transportGeneratorAsync(props);
    const { listener, generator, fromU, toU } = props;

    let subscription = listener ? feedbackStream.subscribe(listener) : null;
    let data: IteratorResult<Map<KeyType, RecordType>>;
    let outBatchSize = toColl.batchSize ?? 30;

    let outMap = new Map();
    let total = 0;
    const flush = (always = false) => {
      if (outMap.size <= 0) return false;
      if (!always && (outBatchSize <= 0 || outMap.size < outBatchSize))
        return false;
      try {
        toColl.setMany(outMap);
        total += outMap.size;
        feedbackStream.next({
          total,
          current: outMap.size,
        });
      } catch (error) {
        feedbackStream.next({
          total,
          error: asError(error),
        });
        return true;
      }
      outMap = new Map();
    };

    do {
      data = generator.next();
      if (data.done) break;
      const dataMap = data.value;

      for (const [key, value] of dataMap) {
        if (value) {
          // Convert to universal format
          const universalRecord = this.toUniversal(
            value,
            fromColl as CollBaseIF,
            fromU,
          );

          // Convert to target format
          const targetRecord = this.toLocal(
            universalRecord,
            toColl as CollBaseIF,
            toU,
          );

          outMap.set(key, targetRecord);
          if (flush()) {
            return subscription;
          }
        } // if value
      } // for
    } while (!data?.done);

    flush(true);
    return subscription;
  }
}
