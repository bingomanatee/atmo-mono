import { asError } from '@wonderlandlabs/atmo-utils';
import { get, set } from 'lodash-es';
import { Subject, Subscription } from 'rxjs';
import { FIELD_TYPES } from './constants';
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

    // Get the field map which now includes univFields mappings
    const map = this.localToUnivFieldMap(collection, fromUnivName);

    // Process all field mappings including nested paths from univFields
    for (const localName of Object.keys(map)) {
      const universalName = map[localName];

      // For nested paths like 'metadata.createdAt', we need to find the parent field
      const parentFieldName = localName.includes('.')
        ? localName.split('.')[0]
        : localName;

      const fieldDef = collection.schema.fields[
        parentFieldName
      ] as FieldLocalIF;

      // Throw an error if the field definition is not present
      if (!fieldDef) {
        throw new Error(
          `Field definition for '${parentFieldName}' not found in schema for collection '${collection.name}'`,
        );
      }

      // Use lodash get to support nested paths like 'position.x' or 'metadata.createdAt'
      // @ts-ignore
      out[universalName] = get(record, localName);

      // Apply export function if it exists and this is not a nested path
      if (fieldDef.export && localName === parentFieldName) {
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

    // First pass: Initialize all complex fields marked as isLocal
    for (const fieldName of Object.keys(coll.schema.fields)) {
      const fieldDef = coll.schema.fields[fieldName] as FieldLocalIF;

      if (fieldDef?.isLocal && !fieldDef.exportOnly) {
        // Initialize complex fields
        switch (fieldDef.type) {
          case FIELD_TYPES.object:
            // If the field has an import function, use it
            if (fieldDef.import) {
              const importedValue = fieldDef.import({
                value: {},
                inputRecord: out,
                currentRecord: record,
              });

              if (importedValue !== undefined) {
                set(out, fieldName, importedValue);
              } else {
                // Default to empty object if import returns undefined
                set(out, fieldName, {});
              }
            } else {
              // Create an empty object
              set(out, fieldName, {});

              /* REDUNDANT CODE - Kept for reference
              // If the field has univFields, map universal fields to local fields
              if (
                fieldDef.univFields &&
                Object.keys(fieldDef.univFields).length > 0
              ) {
                const subObject = get(out, fieldName);
                // Map local field names to universal field names
                for (const [
                  localFieldName,
                  universalFieldName,
                ] of Object.entries(fieldDef.univFields)) {
                  // Get the value from the universal record
                  if (record[universalFieldName] !== undefined) {
                    subObject[localFieldName] = record[universalFieldName];
                  }
                }
              }
              */
              // Note: We don't need to process univFields here anymore
              // as they are now handled by the univToLocalFieldMap method
            }
            break;
          case FIELD_TYPES.array:
            set(out, fieldName, []);
            break;
        }
      }
    }

    // Process all field mappings from the map
    for (const univField of Object.keys(map)) {
      const localField = map[univField];

      // For nested paths like 'metadata.createdAt', we need to find the parent field
      const parentFieldName = localField.includes('.')
        ? localField.split('.')[0]
        : localField;

      // Get the field definition using the parent field name
      const fieldDef = coll.schema.fields[parentFieldName] as FieldLocalIF;

      // Throw an error if the field definition is not present
      if (!fieldDef) {
        throw new Error(
          `Field definition for local field '${parentFieldName}' (mapped from universal field '${univField}') not found in schema for collection '${coll.name}'`,
        );
      }

      // Skip exportOnly fields when converting from universal to local
      if (fieldDef.exportOnly) {
        continue; // Skip exportOnly fields when converting to local
      }

      // Use lodash get to support nested paths
      const value = get(record, univField);

      // Apply field-level import if it exists, otherwise fall back to filter
      // Only apply these functions for non-nested fields (direct fields)
      const finalValue =
        localField === parentFieldName && fieldDef.import
          ? fieldDef.import({ value, inputRecord: out, currentRecord: record })
          : localField === parentFieldName && fieldDef.filter
            ? fieldDef.filter({
                value,
                inputRecord: out,
                currentRecord: record,
              })
            : value;

      // Use lodash set to support nested paths in the output object
      if (localField.includes('.')) {
        // Check if this is a nested field with exportOnly
        const nestedFieldPath = localField;
        const nestedFieldDef = coll.schema.fields[
          nestedFieldPath
        ] as FieldLocalIF;

        // Skip if this is an exportOnly field
        if (nestedFieldDef?.exportOnly) {
          continue;
        }

        // Ensure parent object exists before setting nested property
        const parentField = localField.split('.')[0];
        if (!get(out, parentField)) {
          set(out, parentField, {});
        }
        set(out, localField, finalValue);
      } else {
        out[localField] = finalValue;
      }
    }

    // Apply the schema's import function if it exists, otherwise fall back to filterRecord
    if (coll.schema.import) {
      return coll.schema.import({
        inputRecord: out,
        currentRecord: record,
        univName,
      });
    } else if (coll.schema.filterRecord) {
      return coll.schema.filterRecord({
        inputRecord: out,
        currentRecord: record,
        univName,
      });
    }

    // Check if the universal schema has an import function
    const universalSchema = this.baseSchemas.get(coll.name);
    if (universalSchema?.import) {
      const importedRecord = universalSchema.import({
        inputRecord: out,
        currentRecord: record,
        univName,
      });

      // Copy the imported record properties to the output record
      if (importedRecord && typeof importedRecord === 'object') {
        Object.assign(out, importedRecord);
      }
    }

    // Skip validation during development
    // try {
    //   // Use the collection's validate method
    //   coll.validate(out);
    // } catch (error) {
    //   // Wrap the validation error with more context
    //   throw new Error(`toLocal validation failure: ${error.message}`);
    // }

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

    // First pass: Process univFields mappings from complex local fields
    // Build a map of universal field names to local field paths
    const univFieldsMap = new Map<string, string>();

    for (const fieldName of Object.keys(collection.schema.fields)) {
      const fieldDef = collection.schema.fields[fieldName] as FieldLocalIF;

      // Check if the field has univFields and is a complex local field
      if (
        fieldDef?.isLocal &&
        fieldDef.univFields &&
        Object.keys(fieldDef.univFields).length > 0
      ) {
        // For each univField mapping, create a path to the nested field
        for (const [localFieldName, universalFieldName] of Object.entries(
          fieldDef.univFields,
        )) {
          // Create a path like 'metadata.createdAt' -> 'created_at'
          const nestedPath = `${fieldName}.${localFieldName}`;
          univFieldsMap.set(universalFieldName, nestedPath);

          // Add the mapping
          mappings[nestedPath] = universalFieldName;
        }
      }
    }

    // Second pass: Process regular field mappings
    for (const universalName of Object.keys(univSchema.fields)) {
      // Skip if this field is already mapped via univFields
      if (univFieldsMap.has(universalName)) {
        continue;
      }

      // First, try to find a field with matching universalName
      let collectionField = Array.from(
        Object.values(collection.schema.fields),
      ).find((f) => f.universalName === universalName) as FieldLocalIF;

      // If not found, try to find a field with the same name as the universal field
      if (!collectionField) {
        collectionField = collection.schema.fields[
          universalName
        ] as FieldLocalIF;
      }

      // If still not found, try to find a field with exportOnly that has matching universalName
      if (!collectionField) {
        collectionField = Array.from(
          Object.values(collection.schema.fields),
        ).find(
          (f) => f.exportOnly && f.universalName === universalName,
        ) as FieldLocalIF;
      }

      if (!collectionField) {
        // Check if any field has univFields that map to this universal field
        let foundInUnivFields = false;
        for (const fieldName of Object.keys(collection.schema.fields)) {
          const fieldDef = collection.schema.fields[fieldName] as FieldLocalIF;
          if (
            fieldDef?.isLocal &&
            fieldDef.univFields &&
            Object.values(fieldDef.univFields).includes(universalName)
          ) {
            foundInUnivFields = true;
            break;
          }
        }

        // Only throw an error if the field is not found in univFields
        if (!foundInUnivFields) {
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

        // Skip this field as it's handled by univFields
        continue;
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

    // First pass: Process univFields mappings from complex local fields
    // This needs to be done first to ensure we have mappings for all universal fields
    const univFieldsMap = new Map<string, string>();

    for (const fieldName of Object.keys(collection.schema.fields)) {
      const fieldDef = collection.schema.fields[fieldName] as FieldLocalIF;

      // Check if the field has univFields and is a complex local field
      if (
        fieldDef?.isLocal &&
        fieldDef.univFields &&
        Object.keys(fieldDef.univFields).length > 0
      ) {
        // For each univField mapping, create a path to the nested field
        for (const [localFieldName, universalFieldName] of Object.entries(
          fieldDef.univFields,
        )) {
          // Map universal field name to the nested path
          // This allows the toLocal method to find the correct field to populate
          univFieldsMap.set(
            universalFieldName,
            `${fieldName}.${localFieldName}`,
          );

          // Add the mapping directly to the mappings object
          mappings[universalFieldName] = `${fieldName}.${localFieldName}`;
        }
      }
    }

    // Second pass: Process regular field mappings
    for (const universalFieldName of Object.keys(universalSchema.fields)) {
      // Skip if this field is already mapped via univFields
      if (univFieldsMap.has(universalFieldName)) {
        continue;
      }

      // First, try to find a field with matching universalName
      let localFieldDef = Array.from(
        Object.values(collection.schema.fields),
      ).find((field) => field.universalName === universalFieldName);

      // If not found, try to find a field with the same name as the universal field
      if (!localFieldDef) {
        localFieldDef = collection.schema.fields[universalFieldName];
      }

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
              const targetRecord = this.#translateRecord(value, props);
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
