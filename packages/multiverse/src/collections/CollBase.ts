import { Observable, type Subscribable } from 'rxjs';
import type { CollIF } from '../types.coll';
import type {
  CollBaseIF,
  SchemaLocalIF,
  SunIF,
  UniverseIF,
  UniverseName,
} from '../types.multiverse';
import { validateField } from '../utils/validateField';
import { get } from 'lodash-es';

/**
 * Base class for collections with common functionality
 */
export abstract class CollBase<RecordType, KeyType = string>
  implements CollBaseIF
{
  name: string;
  debug: false;
  protected universe: UniverseIF;
  schema: SchemaLocalIF;
  protected _sun?: SunIF<RecordType, KeyType>;

  constructor(name: string, schema: SchemaLocalIF, universe: UniverseIF) {
    this.name = name;
    this.schema = schema;
    this.universe = universe;
  }

  /**
   * The sun that powers this collection
   */
  public get sun(): SunIF<RecordType, KeyType> {
    if (!this._sun) {
      if (!this._sunF) {
        throw new Error('Sun factory function is not set');
      }
      // Create sun and set up references via factory
      this._sun = this._sunF(this);
      if (!this._sun) {
        throw new Error('Sun factory function returned undefined');
      }
      // Set the collection reference and initialize sun
      this._sun.init(this);
    }
    return this._sun;
  }

  protected abstract _sunF: (
    coll: CollIF<RecordType, KeyType>,
  ) => SunIF<RecordType, KeyType>;

  /**
   * Get a record by key
   * @param key - The key of the record to get
   * @returns The record or undefined if not found
   */
  abstract get(
    key: KeyType,
  ): RecordType | undefined | Promise<RecordType | undefined>;

  /**
   * Set a record
   * @param key - The key of the record to set
   * @param value - The record to set
   */
  abstract set(key: KeyType, value: RecordType): void | Promise<void>;

  /**
   * Check if a record exists
   * @param key - The key of the record to check
   * @returns True if the record exists, false otherwise
   */
  abstract has(key: KeyType): boolean | Promise<boolean>;

  /**
   * Mutate a record
   * @param key - The key of the record to mutate
   * @param mutator - Function to mutate the record
   * @returns The mutated record or undefined if deleted
   */
  abstract mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollIF<RecordType, KeyType>,
    ) => RecordType | void | any | Promise<RecordType | void | any>,
  ): RecordType | undefined | Promise<RecordType | undefined>;

  /**
   * Send a record to another universe
   * @param key - The key of the record to send
   * @param target - The name of the target universe
   */
  abstract send(key: KeyType, target: UniverseName): void | Promise<void>;

  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns An array of records matching the query
   */
  abstract find(query: any): RecordType[] | Promise<RecordType[]>;

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   * @returns void for sync collections, Promise<void> for async collections
   */
  abstract each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollIF<RecordType, KeyType>,
    ) => void | Promise<void>,
  ): void | Promise<void>;

  /**
   * Get the number of records in the collection
   * @returns The number of records
   */
  abstract count(): number | Promise<number>;

  /**
   * Map over each record in the collection and apply a transformation
   * @param mapper - Function to transform each record
   * @returns The number of records processed
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  abstract map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollIF<RecordType, KeyType>,
    ) => RecordType | void | any | Promise<RecordType | void | any>,
  ): number | Promise<number>;

  /**
   * Validate a record against the schema
   * @param record - The record to validate
   * @throws Error if validation fails
   * @returns void if validation passes
   */
  validate<R = RecordType>(record: R): void {
    // Validate each field in the schema
    if (record && typeof record === 'object') {
      for (const fieldName in this.schema.fields) {
        const field = this.schema.fields[fieldName];

        // Skip optional fields that are undefined
        if (field.meta?.optional && record[fieldName] === undefined) {
          continue;
        }
        if (field.exportOnly) {
          continue;
        }

        // Get the field value using lodash get for nested paths
        const value = fieldName.includes('.')
          ? get(record, fieldName)
          : record[fieldName];

        // Validate the field
        const result = validateField(value, fieldName, this.schema, record);
        if (result) {
          throw new Error(`Field '${fieldName}' validation failed: ${result}`);
        }
      }
    }
  }

  abstract getMany$?(
    keys: KeyType[],
  ): Observable<{ key: KeyType; value: RecordType }>;
  abstract getAll$?(): Observable<{ key: KeyType; value: RecordType }>;
  abstract sendMany?(
    keys: KeyType[],
  ): Subscribable<{ key: KeyType; value: RecordType; sent: boolean }>;
}
