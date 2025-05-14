import {
  Multiverse,
  SchemaUniversal,
  FIELD_TYPES,
  Universe,
  SchemaLocal,
  CollSync,
} from '@wonderlandlabs/multiverse';

function coord(prefix = '') {
  return {
    [`${prefix}x`]: FIELD_TYPES.number,
    [`${prefix}y`]: FIELD_TYPES.number,
    [`${prefix}z`]: FIELD_TYPES.number,
  };
}

export interface Plate {
  x: number;
  y: number;
  z: number;
  radius: number;
  density: number;
  thickness: number;
}

export interface PlanetLocal {
  name: string;
  radius: number;
}

const UNIVERSAL_SCHEMA = new Map([
  [
    'planets',
    new SchemaUniversal<Plate>('planets', {
      id: FIELD_TYPES.string,
      radius: FIELD_TYPES.number,
      name: { type: FIELD_TYPES.string, meta: { optional: true } },
    }),
  ],
  [
    'plates',
    new SchemaUniversal<Plate>('plates', {
      id: FIELD_TYPES.string,
      x: FIELD_TYPES.number,
      y: FIELD_TYPES.number,
      z: FIELD_TYPES.number,
      radius: FIELD_TYPES.number,
      density: FIELD_TYPES.number,
      thickness: FIELD_TYPES.number,
      name: { type: FIELD_TYPES.string, meta: { optional: true } },
    }),
  ],
  [
    'plate_step',
    new SchemaUniversal<Plate>('plate_step', {
      id: FIELD_TYPES.string,
      plateId: FIELD_TYPES.string,
      x: FIELD_TYPES.number,
      y: FIELD_TYPES.number,
      z: FIELD_TYPES.number,
      step: FIELD_TYPES.number,
      ...coord('v'),
      ...coord('0'),
    }),
  ],
  [
    'sim',
    new SchemaUniversal<Plate>('sim', {
      id: FIELD_TYPES.string,
      name: FIELD_TYPES.string,
      planetId: FIELD_TYPES.string,
    }),
  ],
]);

function simUniverse(mv: Multiverse) {
  const simUniv = new Universe('simUniv', mv);
  simUniv.add(
    new SchemaLocal('plates', {
      id: FIELD_TYPES.string,
      name: {
        type: FIELD_TYPES.string,
        meta: {
          optional: true,
        },
      },
      position: { type: FIELD_TYPES.object, isLocal: true },
      'position.x': {
        exportOnly: true,
        type: FIELD_TYPES.number,
        universalName: 'x',
      },
      'position.y': {
        exportOnly: true,
        type: FIELD_TYPES.number,
        universalName: 'y',
      },
      'position.z': {
        exportOnly: true,
        type: FIELD_TYPES.number,
        universalName: 'z',
      },
    }),
  );

  simUniv.add(
    new SchemaLocal('planets', {
      id: FIELD_TYPES.string,
      name: {
        type: FIELD_TYPES.string,
        meta: {
          optional: true,
        },
      },
      radius: FIELD_TYPES.number,
    }),
  );

  return simUniv;
}

export class PlateSimulation {
  #mv: Multiverse;

  constructor() {
    this.#mv = new Multiverse(UNIVERSAL_SCHEMA);
    this.#mv.add(simUniverse(this.#mv));
  }

  /**
   * Add a universe to the multiverse
   * @param universe The universe to add
   */
  addUniverse(universe: Universe): void {
    this.#mv.add(universe);
  }

  /**
   * Get a universe by name
   * @param name The name of the universe
   * @returns The universe with the given name, or undefined if not found
   */
  getUniverse(name: string): Universe | undefined {
    return this.#mv.getUniverse(name);
  }

  /**
   * Transport multiple records from one universe to another using a reactive stream
   * @param keys Array of record keys to transport
   * @param sourceCollection Source collection
   * @param targetCollection Target collection
   * @param sourceUniverseName Source universe name
   * @param targetUniverseName Target universe name
   * @returns Promise that resolves to an array of transported record keys
   */
  async transportMany(
    keys: string[],
    sourceCollection: string,
    targetCollection: string,
    sourceUniverseName: string,
    targetUniverseName: string,
  ): Promise<string[]> {
    const sourceUniverse = this.getUniverse(sourceUniverseName);
    const targetUniverse = this.getUniverse(targetUniverseName);

    if (!sourceUniverse || !targetUniverse) {
      throw new Error('Source or target universe not found');
    }

    const sourceCollObj = sourceUniverse.getCollection(sourceCollection);
    const targetCollObj = targetUniverse.getCollection(targetCollection);

    if (!sourceCollObj || !targetCollObj) {
      throw new Error('Source or target collection not found');
    }

    const results: string[] = [];

    // Check if the collection's engine supports getMany$
    if (typeof sourceCollObj.engine?.getMany$ === 'function') {
      // Use reactive stream for processing
      return new Promise((resolve, reject) => {
        // Create a stream of records from the keys
        const recordStream = sourceCollObj.engine.getMany$(keys);

        // Subscribe to the stream
        const subscription = recordStream.subscribe({
          next: ({ key, value }) => {
            try {
              if (value) {
                // Convert to universal format
                const universalRecord = this.#mv.toUniversal(
                  value,
                  sourceCollObj,
                  sourceUniverseName,
                );

                // Convert to target format
                const targetRecord = this.#mv.toLocal(
                  universalRecord,
                  targetCollObj,
                  targetUniverseName,
                );

                // Save to target collection
                targetCollObj
                  .set('', targetRecord)
                  .then((targetKey) => {
                    results.push(targetKey);
                  })
                  .catch((error) => {
                    subscription.unsubscribe();
                    reject(error);
                  });
              }
            } catch (error) {
              subscription.unsubscribe();
              reject(error);
            }
          },
          error: (error) => {
            reject(error);
          },
          complete: () => {
            resolve(results);
          },
        });
      });
    } else {
      // Fallback to non-reactive implementation
      for (const key of keys) {
        // Get the record from the source collection
        const record = await sourceCollObj.get(key);

        if (record) {
          // Convert to universal format
          const universalRecord = this.#mv.toUniversal(
            record,
            sourceCollObj,
            sourceUniverseName,
          );

          // Convert to target format
          const targetRecord = this.#mv.toLocal(
            universalRecord,
            targetCollObj,
            targetUniverseName,
          );

          // Save to target collection
          const targetKey = await targetCollObj.set('', targetRecord);
          results.push(targetKey);
        }
      }

      return results;
    }
  }

  /**
   * Transport all records from one universe to another using a reactive stream
   * @param sourceCollection Source collection
   * @param targetCollection Target collection
   * @param sourceUniverseName Source universe name
   * @param targetUniverseName Target universe name
   * @returns Promise that resolves to an array of transported record keys
   */
  async transportAll(
    sourceCollection: string,
    targetCollection: string,
    sourceUniverseName: string,
    targetUniverseName: string,
  ): Promise<string[]> {
    const sourceUniverse = this.getUniverse(sourceUniverseName);
    const targetUniverse = this.getUniverse(targetUniverseName);

    if (!sourceUniverse || !targetUniverse) {
      throw new Error('Source or target universe not found');
    }

    const sourceCollObj = sourceUniverse.getCollection(sourceCollection);
    const targetCollObj = targetUniverse.getCollection(targetCollection);

    if (!sourceCollObj || !targetCollObj) {
      throw new Error('Source or target collection not found');
    }

    // Check if the collection supports getAll$ (reactive version of getAll)
    if (typeof sourceCollObj.getAll$ === 'function') {
      const results: string[] = [];

      // Use reactive stream for processing
      return new Promise((resolve, reject) => {
        // Create a stream of all records
        const recordStream = sourceCollObj.getAll$();

        // Subscribe to the stream
        const subscription = recordStream.subscribe({
          next: ({ key, value }) => {
            try {
              if (value) {
                // Convert to universal format
                const universalRecord = this.#mv.toUniversal(
                  value,
                  sourceCollObj,
                  sourceUniverseName,
                );

                // Convert to target format
                const targetRecord = this.#mv.toLocal(
                  universalRecord,
                  targetCollObj,
                  targetUniverseName,
                );

                // Save to target collection
                targetCollObj
                  .set('', targetRecord)
                  .then((targetKey) => {
                    results.push(targetKey);
                  })
                  .catch((error) => {
                    subscription.unsubscribe();
                    reject(error);
                  });
              }
            } catch (error) {
              subscription.unsubscribe();
              reject(error);
            }
          },
          error: (error) => {
            reject(error);
          },
          complete: () => {
            resolve(results);
          },
        });
      });
    } else {
      // Fallback to non-reactive implementation
      // Get all records from the source collection
      const records = await sourceCollObj.getAll();
      const keys = records.map((record: any) => record.id);

      // Transport all records
      return this.transportMany(
        keys,
        sourceCollection,
        targetCollection,
        sourceUniverseName,
        targetUniverseName,
      );
    }
  }

  /**
   * Send multiple records to a collection in a universe using a reactive stream
   * @param records Array of records to send
   * @param collectionName Collection name
   * @param universeName Universe name
   * @returns Promise that resolves to an array of record keys
   */
  async sendMany(
    records: any[],
    collectionName: string,
    universeName: string,
  ): Promise<string[]> {
    const universe = this.getUniverse(universeName);

    if (!universe) {
      throw new Error(`Universe ${universeName} not found`);
    }

    const collection = universe.getCollection(collectionName);

    if (!collection) {
      throw new Error(
        `Collection ${collectionName} not found in universe ${universeName}`,
      );
    }

    // Check if the collection supports setMany$ (reactive version of set for multiple records)
    if (typeof collection.setMany$ === 'function') {
      const results: string[] = [];

      // Use reactive stream for processing
      return new Promise((resolve, reject) => {
        // Create a stream from the records array
        const recordStream = collection.setMany$(records);

        // Subscribe to the stream
        const subscription = recordStream.subscribe({
          next: ({ key }) => {
            if (key) {
              results.push(key);
            }
          },
          error: (error) => {
            reject(error);
          },
          complete: () => {
            resolve(results);
          },
        });
      });
    } else {
      // Fallback to non-reactive implementation
      const results: string[] = [];

      // Use a generator pattern to process records in batches
      for (const record of records) {
        const key = await collection.set('', record);
        results.push(key);
      }

      return results;
    }
  }

  /**
   * Send all records from a source to a target
   * @param sourceRecords Function that returns all records to send or an Observable of records
   * @param collectionName Target collection name
   * @param universeName Target universe name
   * @returns Promise that resolves to an array of record keys
   */
  async sendAll(
    sourceRecords: (() => Promise<any[]>) | any,
    collectionName: string,
    universeName: string,
  ): Promise<string[]> {
    const universe = this.getUniverse(universeName);

    if (!universe) {
      throw new Error(`Universe ${universeName} not found`);
    }

    const collection = universe.getCollection(collectionName);

    if (!collection) {
      throw new Error(
        `Collection ${collectionName} not found in universe ${universeName}`,
      );
    }

    // Check if sourceRecords is an Observable
    if (sourceRecords && typeof sourceRecords.subscribe === 'function') {
      const results: string[] = [];

      // Use reactive stream for processing
      return new Promise((resolve, reject) => {
        // Subscribe to the stream
        const subscription = sourceRecords.subscribe({
          next: (record: any) => {
            try {
              // Save to target collection
              collection
                .set('', record)
                .then((key) => {
                  results.push(key);
                })
                .catch((error) => {
                  subscription.unsubscribe();
                  reject(error);
                });
            } catch (error) {
              subscription.unsubscribe();
              reject(error);
            }
          },
          error: (error: any) => {
            reject(error);
          },
          complete: () => {
            resolve(results);
          },
        });
      });
    } else {
      // Fallback to non-reactive implementation
      const records = await sourceRecords();
      return this.sendMany(records, collectionName, universeName);
    }
  }
}
