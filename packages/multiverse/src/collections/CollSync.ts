import { Observable } from 'rxjs';
import memorySunF from '../suns/SunMemory.ts';
import type { CollIF, CollSyncIF } from '../types.coll.ts';
import type {
  SchemaLocalIF,
  SunIFSync,
  UniverseIF,
  UniverseName,
} from '../types.multiverse.ts';

type CollParms<RecordType, KeyType = string> = {
  name: string;
  schema: SchemaLocalIF;
  universe: UniverseIF;
  sunF?: (coll: CollIF<RecordType, KeyType>) => SunIFSync<RecordType, KeyType>; // will default to memorySunF
};

export class CollSync<RecordType, KeyType = string>
  implements CollSyncIF<RecordType, KeyType>
{
  name: string;
  #universe: UniverseIF;
  schema: SchemaLocalIF;
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

  #engine: SunIFSync<RecordType, KeyType>;

  get(identity: KeyType): RecordType | undefined {
    return this.#engine.get(identity);
  }

  has(key: KeyType): boolean {
    return this.#engine.has(key);
  }

  set(key: KeyType, value: RecordType): void {
    this.#engine.set(key, value);
  }

  mutate(
    key: KeyType,
    mutator: (
      draft: RecordType | undefined,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType | void | any,
  ): RecordType | undefined {
    if (typeof this.#engine.mutate !== 'function') {
      throw new Error(
        `collection ${this.name} engine does not support mutation`,
      );
    }
    return this.#engine.mutate(key, mutator);
  }

  /**
   * Get all records as a generator of batches
   * @returns Generator that yields batches of records
   */
  getAll(): Generator<Map<KeyType, RecordType>, void, any> {
    if (!this.#engine.getAll) {
      throw new Error('getAll method not implemented by engine');
    }
    return this.#engine.getAll();
  }
  /**
   * Find records matching a query
   * @param query - The query to match against
   * @returns Generator that yields batches of matching records
   * @throws Error if the engine does not implement find
   */
  find(...args: any[]): Generator<Map<KeyType, RecordType>, void, any> {
    // Process arguments
    let query: any;

    if (args.length === 2 && typeof args[0] === 'string') {
      // Format: find(prop, value)
      const [prop, value] = args;
      query = { [prop]: value };
    } else {
      // Format: find(query) or find(predicate)
      query = args[0];
    }

    // If the engine has a find method, use it
    if (typeof this.#engine.find === 'function') {
      return this.#engine.find(query);
    }

    // Throw an error if find is not implemented
    throw new Error(`Find method not implemented for collection ${this.name}`);
  }

  /**
   * Map over each record in the collection return the updated items
   * @param mapper - Function to transform each record
   * @returns a Map of record
   * @throws MapError if any mapper function throws and noTransaction is false
   */
  map(
    mapper: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => RecordType,
  ): Map<KeyType, RecordType> {
    if (typeof this.#engine.map === 'function') {
      return this.#engine.map((record, key) => mapper(record, key, this));
    }

    if (typeof this.#engine.keys !== 'function') {
      throw new Error(
        'This collection cannot implement map: engine as no keys or map  functions',
      );
    }

    return new Map(
      Array.from(this.#engine.keys()).map((key) => {
        const record = this.get(key)!;
        return [key, mapper(record, key, this)];
      }),
    );
  }

  send(key: KeyType, target: UniverseName): void {
    if (!this.#universe.multiverse) {
      throw new Error(
        'CollSync.send: multiverse not set on universe ' + this.#universe.name,
      );
    }
    if (!this.has(key)) throw new Error(this.name + 'does not have key ' + key);
    this.#universe.multiverse.transport(
      key,
      this.name,
      this.#universe.name,
      target,
    );
  }

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   */
  each(
    callback: (
      record: RecordType,
      key: KeyType,
      collection: CollSyncIF<RecordType, KeyType>,
    ) => void,
  ): void {
    // If the engine has an each method, use it
    if (typeof this.#engine.each === 'function') {
      this.#engine.each((record, key) => callback(record, key, this));
      return;
    }

    // Fallback implementation using keys
    if (typeof this.#engine.keys !== 'function') {
      throw new Error(
        `Each method not implemented for collection ${this.name}`,
      );
    }
    const keys = this.#engine.keys();
    for (const key of keys) {
      const record = this.get(key)!;
      callback(record, key, this);
    }
    return;
  }

  /**
   * Get the number of records in the collection
   * @returns The number of records
   */
  count(): number {
    // If the engine has a count method, use it
    if (typeof this.#engine.count === 'function') {
      return this.#engine.count();
    }

    // Fallback implementation using keys
    if (typeof this.#engine.keys === 'function') {
      return this.#engine.keys().length;
    }

    // Throw an error if neither count nor keys is implemented
    throw new Error(`Count method not implemented for collection ${this.name}`);
  }

  /**
   * Get multiple records as a generator of {key, value} pairs
   * @param keys Array of record keys to get
   * @returns Generator that yields records one by one
   */
  getMany(keys: KeyType[]): Generator<{ key: KeyType; value: RecordType }> {
    // If the engine has a getMany method, use it
    if (typeof this.#engine.getMany === 'function') {
      return this.#engine.getMany(keys);
    }

    // Fallback implementation
    return function* () {
      // Yield each record from the keys array
      for (const key of keys) {
        try {
          const value = this.get(key);
          if (value !== undefined) {
            yield { key, value };
          }
        } catch (error) {
          // Log error but continue processing
          console.error(`Error getting record ${key}:`, error);
        }
      }
    }.bind(this)();
  }

  /**
   * Get multiple records as a stream of {key, value} pairs
   * Designed for batch processing of potentially large datasets
   * @param keys Array of record keys to get
   * @param batchSize Optional batch size for processing records (default: 50)
   * @returns Observable that emits batches of records and completes when all records are processed
   */
  getMany$(
    keys: KeyType[],
    batchSize: number = 50,
  ): Observable<{ key: KeyType; value: RecordType }> {
    // If the engine has a getMany$ method, use it
    if (typeof this.#engine.getMany$ === 'function') {
      return this.#engine.getMany$(keys, batchSize);
    }

    // Get a generator from getMany
    const generator = this.getMany(keys);

    // Convert the generator to an Observable
    return this.createObservableFromGenerator(generator, batchSize);
  }

  /**
   * Get all records as a generator of {key, value} pairs
   * @returns Generator that yields records one by one
   */
  getAllGen(): Generator<{ key: KeyType; value: RecordType }> {
    // If the engine has an getAllGen method, use it
    if (typeof this.#engine.getAllGen === 'function') {
      return this.#engine.getAllGen();
    }

    // If getAll returns a generator, just return it
    if (typeof this.#engine.getAll === 'function') {
      return this.getAll();
    }

    // Fallback implementation using getAllAsMap
    return function* () {
      // Get all records as a Map
      const records = this.getAllAsMap();

      // Yield each record from the Map
      for (const [key, value] of records.entries()) {
        try {
          yield { key, value };
        } catch (error) {
          // Log error but continue processing
          console.error(`Error processing record ${key}:`, error);
        }
      }
    }.bind(this)();
  }

  /**
   * Get all records as a stream of {key, value} pairs
   * Designed for batch processing of potentially large datasets
   * @param batchSize Optional batch size for processing records (default: 50)
   * @returns Observable that emits batches of records and completes when all records are processed
   */
  getAll$(
    batchSize: number = 50,
  ): Observable<{ key: KeyType; value: RecordType }> {
    // If the engine has a getAll$ method, use it
    if (typeof this.#engine.getAll$ === 'function') {
      return this.#engine.getAll$(batchSize);
    }

    // Get a generator from getAllGen
    const generator = this.getAllGen();

    // Convert the generator to an Observable
    return this.createObservableFromGenerator(generator, batchSize);
  }

  /**
   * Set multiple records from a Map
   * @param recordMap Map of records to set
   * @returns Number of records set
   */
  setMany(recordMap: Map<KeyType, RecordType>): number {
    // If the engine has a setMany method, use it
    if (typeof this.#engine.setMany === 'function') {
      return this.#engine.setMany(recordMap);
    }

    // Fallback implementation using set
    let count = 0;
    for (const [key, record] of recordMap.entries()) {
      try {
        this.set(key, record);
        count++;
      } catch (error) {
        console.error(`Error setting record ${key}:`, error);
      }
    }

    return count;
  }

  /**
   * Set multiple records and return a stream of {key} values
   * Designed for batch processing of potentially large datasets
   * @param records Array of records to set
   * @param batchSize Optional batch size for processing records (default: 100)
   * @returns Observable that emits keys of successfully set records and completes when all records are processed
   */
  setMany$(
    records: RecordType[],
    batchSize: number = 100,
  ): Observable<{ key: KeyType }> {
    // If the engine has a setMany$ method, use it
    if (typeof this.#engine.setMany$ === 'function') {
      return this.#engine.setMany$(records, batchSize);
    }

    // Fallback implementation using set with batching
    return new Observable<{ key: KeyType }>((subscriber) => {
      const totalRecords = records.length;
      const batches = Math.ceil(totalRecords / batchSize);

      // Process records in batches
      let batchIndex = 0;

      const processBatch = () => {
        if (batchIndex >= batches) {
          // All batches processed, complete the stream
          subscriber.complete();
          return;
        }

        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, totalRecords);
        const batchRecords = records.slice(batchStart, batchEnd);

        // Process this batch
        for (const record of batchRecords) {
          try {
            // Note: This assumes set returns the key, which might not be true
            // We might need to extract the key from the record
            const key = this.set(record);
            subscriber.next({ key });
          } catch (error) {
            // Log error but continue processing
            console.error('Error setting record:', error);
          }
        }

        // Move to next batch
        batchIndex++;

        // Schedule next batch processing
        setTimeout(processBatch, 0);
      };

      // Start processing
      processBatch();

      // Return cleanup function
      return () => {
        // Cancel any pending operations if the subscription is disposed
        batchIndex = batches; // This will prevent further processing
      };
    });
  }

  /**
   * Send multiple records to another universe
   * Processes records in batches for efficient transport
   * @param keys Array of record keys to send
   * @param targetCollection Target collection name
   * @param targetUniverseName Target universe name
   * @param batchSize Optional batch size for processing records (default: 100)
   * @returns Observable that emits progress updates and completes when the stream is finished
   */
  sendMany(
    keys: KeyType[],
    targetCollection: string,
    targetUniverseName: UniverseName,
    batchSize: number = 100,
  ): Observable<{
    processed: number;
    successful: number;
    failed: number;
    total: number;
    key?: KeyType;
    error?: Error;
  }> {
    // Get the multiverse instance
    const multiverse = this.#universe.multiverse;
    if (!multiverse) {
      throw new Error('Multiverse not found');
    }

    // Create a stream of records using getMany$
    const recordStream = this.getMany$(keys, batchSize);

    // Use transportStream to send the records to the target universe
    return multiverse.transportStream<RecordType, KeyType>(
      recordStream,
      this.name,
      this.#universe.name,
      targetUniverseName,
    );
  }

  /**
   * Send multiple records to another universe
   * Processes records in batches for efficient transport
   * @param keys Array of record keys to send
   * @param target Target universe name
   * @param batchSize Optional batch size for processing records (default: 100)
   * @returns Observable of {key, value, sent} objects
   */
  sendMany$(
    keys: KeyType[],
    target: UniverseName,
    batchSize: number = 100,
  ): Observable<{ key: KeyType; value: RecordType; sent: boolean }> {
    return new Observable<{ key: KeyType; value: RecordType; sent: boolean }>(
      (subscriber) => {
        const totalKeys = keys.length;
        const batches = Math.ceil(totalKeys / batchSize);

        // Process records in batches
        let batchIndex = 0;

        const processBatch = () => {
          if (batchIndex >= batches) {
            // All batches processed, complete the stream
            subscriber.complete();
            return;
          }

          const batchStart = batchIndex * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, totalKeys);
          const batchKeys = keys.slice(batchStart, batchEnd);

          // Process this batch
          for (const key of batchKeys) {
            try {
              const value = this.get(key);
              if (value !== undefined) {
                this.send(key, target);
                subscriber.next({ key, value, sent: true });
              } else {
                subscriber.next({
                  key,
                  value: undefined as unknown as RecordType,
                  sent: false,
                });
              }
            } catch (error) {
              subscriber.next({
                key,
                value: undefined as unknown as RecordType,
                sent: false,
              });
              console.error(`Error sending record ${key}:`, error);
            }
          }

          // Move to next batch
          batchIndex++;

          // Schedule next batch processing
          setTimeout(processBatch, 0);
        };

        // Start processing
        processBatch();

        // Return cleanup function
        return () => {
          // Cancel any pending operations if the subscription is disposed
          batchIndex = batches; // This will prevent further processing
        };
      },
    );
  }

  /**
   * Send all records to another universe
   * Processes records in batches for efficient transport
   * @param targetCollection Target collection name
   * @param targetUniverseName Target universe name
   * @param batchSize Optional batch size for processing records (default: 100)
   * @returns Observable that emits progress updates and completes when the stream is finished
   */
  sendAll(
    targetCollection: string,
    targetUniverseName: UniverseName,
    batchSize: number = 100,
  ): Observable<{
    processed: number;
    successful: number;
    failed: number;
    total?: number;
    key?: KeyType;
    error?: Error;
  }> {
    // Get the multiverse instance
    const multiverse = this.#universe.multiverse;
    if (!multiverse) {
      throw new Error('Multiverse not found');
    }

    // Get all keys from the collection
    const records = this.getAll();
    const keys = Array.from(records.keys());

    // Use sendMany to send all records
    return this.sendMany(keys, targetCollection, targetUniverseName, batchSize);
  }

  /**
   * Send all records to another universe
   * Processes records in batches for efficient transport
   * @param target Target universe name
   * @param batchSize Optional batch size for processing records (default: 100)
   * @returns Observable of {key, value, sent} objects
   */
  sendAll$(
    target: UniverseName,
    batchSize: number = 100,
  ): Observable<{ key: KeyType; value: RecordType; sent: boolean }> {
    return new Observable<{ key: KeyType; value: RecordType; sent: boolean }>(
      (subscriber) => {
        // Get all records
        const records = this.getAll();
        const entries = Array.from(records.entries());
        const totalEntries = entries.length;
        const batches = Math.ceil(totalEntries / batchSize);

        // Process records in batches
        let batchIndex = 0;

        const processBatch = () => {
          if (batchIndex >= batches) {
            // All batches processed, complete the stream
            subscriber.complete();
            return;
          }

          const batchStart = batchIndex * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, totalEntries);
          const batchEntries = entries.slice(batchStart, batchEnd);

          // Process this batch
          for (const [key, value] of batchEntries) {
            try {
              this.send(key, target);
              subscriber.next({ key, value, sent: true });
            } catch (error) {
              subscriber.next({ key, value, sent: false });
              console.error(`Error sending record ${key}:`, error);
            }
          }

          // Move to next batch
          batchIndex++;

          // Schedule next batch processing
          setTimeout(processBatch, 0);
        };

        // Start processing
        processBatch();

        // Return cleanup function
        return () => {
          // Cancel any pending operations if the subscription is disposed
          batchIndex = batches; // This will prevent further processing
        };
      },
    );
  }
}
