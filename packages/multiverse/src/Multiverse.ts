import { asError } from '@wonderlandlabs/atmo-utils';
import { get, set } from 'lodash-es';
import { Subject, Subscription } from 'rxjs';
import { FIELD_TYPES } from './constants';
import { isObj } from './typeguards.multiverse';
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
    if (
      !replace &&
      this.#universes.has(u.name) &&
      this.#universes.get(u.name) !== u
    ) {
      throw new Error(`Universe ${u.name} already exists`);
    }

    this.#universes.set(u.name, u);
    return u;
  }

  toUniversal<ToRecord = DataRecord>(
    record: any,
    collection: CollBaseIF,
    fromUnivName: string,
    key: KeyType,
  ): ToRecord {
    // @ts-ignore
    const out: ToRecord = {};

    // Get the existing record if possible (for currentValue)
    let existingRecord = collection.get(key);

    // Get the field map which now includes univFields mappings
    const map = this.localToUnivFieldMap(collection, fromUnivName);
    if (collection.debug)
      console.log(
        'toUniversal: from ',
        record,
        'with  map',
        map,
        'from',
        fromUnivName,
      );
    // Process all field mappings including nested paths from univFields
    for (const [localName, universalName] of Object.entries(map)) {
      // @ts-ignore
      set(out, universalName, get(record, localName));
    }

    for (const [localName, fieldDef] of Object.entries(
      collection.schema.fields,
    )) {
      const localValue = get(record, localName);
      let targetName = fieldDef.universalName ?? localName;
      if (typeof fieldDef.export === 'function') {
        const value = fieldDef.export({
          currentRecord: existingRecord,
          newValue: localValue,
          field: fieldDef,
          inputRecord: record,
          univName: targetName,
        });
        if (typeof value !== 'undefined') {
          set(out, targetName, value);
        }
      }
    }

    if (collection.debug) console.log('toUniversal: ', out);

    return out;
  }

  toLocal(record: any, coll: CollBaseIF, univName: string): any {
    const out: Record<string, any> = {};
    const map = this.univToLocalFieldMap(coll, univName);

    if (coll.debug) {
      console.log('converting ', record, 'to', univName, 'with', map);
    }
    // Process all field mappings from the map
    for (const univField of Object.keys(map)) {
      const localField = map[univField];
      set(out, localField, get(record, univField));
    }

    // First pass: Initialize all complex fields marked as isLocal
    for (const [fieldName, fieldDef] of Object.entries(coll.schema.fields)) {
      if (typeof fieldDef.import === 'function') {
        const importedValue = fieldDef.import({
          value: get(out, fieldName),
          inputRecord: record,
          currentRecord: out,
        });

        if (importedValue !== undefined) {
          set(out, fieldName, importedValue);
        }
      }

      const outValue = get(out, fieldName);

      switch (fieldDef.type) {
        case FIELD_TYPES.object:
          if (!isObj(outValue)) {
            set(out, fieldName, {});
          }
          break;

        case FIELD_TYPES.array:
          if (!Array.isArray(outValue)) {
            set(out, fieldName, []);
          }
      }
    }

    try {
      // Use the collection's validate method
      if (typeof coll.validate === 'function') {
        coll.validate(out);
      }
    } catch (error) {
      // Wrap the validation error with more context
      console.error(
        'cannot validate local ',
        univName,
        ' record:',
        out,
        'mapped from universal record ',
        record,
        'with',
        map,
        asError(error).message,
      );
      throw new Error(`toLocal validation failure: ${error.message}`);
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

    for (const fieldName of Object.keys(collection.schema.fields)) {
      const fieldDef = collection.schema.fields[fieldName] as FieldLocalIF;
      let nestedPath;
      // Check if the field has univFields and is a complex local field
      if (fieldDef.univFields) {
        // For each univField mapping, create a path to the nested field
        for (const [localFieldName, univFieldName] of Object.entries(
          fieldDef.univFields,
        )) {
          // Create a path like 'metadata.createdAt' -> 'created_at'
          nestedPath = `${fieldName}.${localFieldName}`;
          mappings[nestedPath] = univFieldName;
        }
      } else if (fieldDef.universalName) {
        mappings[fieldName] = fieldDef.universalName;
      } else if (!fieldDef.isLocal) {
        mappings[fieldName] = fieldName;
      }
    }

    // Second pass: Process regular field mappings
    for (const universalName of Object.keys(univSchema.fields)) {
      // Skip if this field is already mapped via univFields
      if (!Array.from(Object.values(mappings).includes(universalName))) {
        throw new Error(`universal field ${universalName} not mapped`);
      }
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

    if (collection.debug) {
      console.log('translating to LOCAL with schema', collection.schema.fields);
    }

    const mappings: Record<string, string> = {};

    if (!universalSchema.fields) {
      console.warn('no fields in ', universalSchema);
    }

    for (const [localFieldName, fieldDef] of Object.entries(
      collection.schema.fields,
    )) {
      if (fieldDef.exportOnly) {
        if (collection.debug)
          console.log('---- skipping export field ', localFieldName);
        continue;
      }
      // Check if the field has univFields and is a complex local field
      if (fieldDef.univFields) {
        // For each univField mapping, create a path to the nested field
        for (const [localSubName, localUniversalName] of Object.entries(
          fieldDef.univFields,
        )) {
          // Add the mapping directly to the mappings object
          const compound = `${localFieldName}.${localSubName}`;
          mappings[localUniversalName] = compound;
          if (collection.debug) {
            console.log('mapped ', localUniversalName, 'to', compound);
          }
        }
      } else if (fieldDef.universalName) {
        mappings[fieldDef.universalName] = localFieldName;
        if (collection.debug) {
          console.log('mapped ', fieldDef.universalName, 'to', localFieldName);
        }
      } else {
        if (collection.debug) {
          console.log('mapped ', localFieldName, 'directly');
        }
        mappings[localFieldName] = localFieldName;
      }
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

    const localize = this.#translateRecord(record, props, key);
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

    const localize = this.#translateRecord(record, props, key);
    return toColl.set(key, localize);
  }

  #translateRecord<RecordType = DataRecord, KeyType = any>(
    localRecord: RecordType,
    props: TransportProps<RecordType, KeyType>,
    key: KeyType,
  ): any {
    const { fromU, toU, collectionName } = props;
    const { fromColl, toColl } = this.#initTransport<RecordType, KeyType>(
      props,
    );

    // Convert to universal format
    const universalRecord = this.toUniversal(
      localRecord,
      fromColl as CollBaseIF,
      fromU,
      key,
    );

    return this.toLocal(universalRecord, toColl as CollBaseIF, toU);
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
    let outBatchSize = 30;

    let outMap = new Map();
    let total = 0;
    let pending = 0;

    // Function to ensure complete is called and cleanup is done
    const completeAndCleanup = () => {
      try {
        if (pending <= 0) {
          feedbackStream.complete();
        }
      } catch (err) {
        console.error('Error during stream completion:', err);
      }
    };

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
        // Convert the error to an Error object if it's not already
        const errorObj =
          error instanceof Error ? error : new Error(String(error));

        // Send the error to the listener
        feedbackStream.next({
          total,
          error: errorObj,
        });
      } finally {
        pending -= 1;
        if (always) {
          completeAndCleanup();
        }
      }
    };

    const flush = (always = false) => {
      pending += 1;
      flushInner(outMap, always); // NOT waiting for async result
      outMap = new Map();
    };

    try {
      do {
        data = generator.next();
        if (data.done) break;
        const dataMap = data.value;

        for (const [key, value] of dataMap) {
          if (value) {
            try {
              const targetRecord = this.#translateRecord(value, props, key);
              outMap.set(key, targetRecord);
              flush();
            } catch (error) {
              // Convert the error to an Error object if it's not already
              const errorObj =
                error instanceof Error ? error : new Error(String(error));

              // Send the error to the listener
              feedbackStream.next({
                total,
                error: errorObj,
              });
            }
          } // if value
        } // for
      } while (!data?.done);

      flush(true);
    } catch (error) {
      // Handle any unexpected errors
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      feedbackStream.next({
        total,
        error: errorObj,
      });

      // Force completion if there are no pending operations
      if (pending <= 0) {
        completeAndCleanup();
      }
    }

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
    let outBatchSize = toColl.batchSize ?? 30;
    let outMap = new Map();
    let total = 0;

    // Function to ensure complete is called and cleanup is done
    const completeAndCleanup = () => {
      try {
        feedbackStream.complete();
      } catch (err) {
        console.error('Error during stream completion:', err);
      }
    };

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
        // Convert the error to an Error object if it's not already
        const errorObj =
          error instanceof Error ? error : new Error(String(error));

        feedbackStream.next({
          total,
          error: errorObj,
        });

        // Always complete the stream when there's an error
        completeAndCleanup();
        return true;
      }
      outMap = new Map();
    };

    try {
      for (const [key, value] of generator) {
        if (value) {
          try {
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
              completeAndCleanup();
              return subscription;
            }
          } catch (error) {
            // Convert the error to an Error object if it's not already
            const errorObj =
              error instanceof Error ? error : new Error(String(error));

            feedbackStream.next({
              total,
              error: errorObj,
            });

            // Complete the stream when there's an error
            completeAndCleanup();
            return subscription;
          }
        } // if value
      } // for

      flush(true);

      // Always complete the stream when done
      completeAndCleanup();
    } catch (error) {
      // Handle any unexpected errors
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      feedbackStream.next({
        total,
        error: errorObj,
      });

      // Complete the stream when there's an error
      completeAndCleanup();
    }

    return subscription;
  }
}
