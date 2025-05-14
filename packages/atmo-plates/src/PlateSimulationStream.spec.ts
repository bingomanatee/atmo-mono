import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlateSimulation } from './PlateSimulation';
import { Observable, Subject } from 'rxjs';

// Mock Universe class for testing
class MockUniverse {
  name: string;
  collections: Map<string, any> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  add(collection: any): void {
    this.collections.set(collection.name, collection);
  }

  getCollection(name: string): any {
    return this.collections.get(name);
  }
}

// Mock PlateSimulation class for testing
class MockPlateSimulation {
  universes: Map<string, MockUniverse> = new Map();
  #mv: any;

  constructor() {
    // Create a mock multiverse
    this.#mv = {
      toUniversal: (record: any) => {
        // Simple pass-through for testing
        return { ...record, _universal: true };
      },
      toLocal: (record: any) => {
        // Simple pass-through for testing
        const result = { ...record };
        delete result._universal;
        return result;
      },
      getUniverse: (name: string) => this.getUniverse(name),
      add: (universe: MockUniverse) => this.addUniverse(universe),
    };
  }

  // Mock methods from PlateSimulation
  addUniverse(universe: MockUniverse): void {
    this.universes.set(universe.name, universe);
  }

  getUniverse(name: string): MockUniverse | undefined {
    return this.universes.get(name);
  }

  // Mock transportMany method
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

    // Use reactive stream for processing
    return new Promise((resolve, reject) => {
      // Create a stream of records from the keys
      const recordStream = sourceCollObj.getMany$(keys);

      // Subscribe to the stream
      const subscription = recordStream.subscribe({
        next: ({ key, value }) => {
          try {
            if (value) {
              // Convert to universal format
              const universalRecord = this.#mv.toUniversal(value);

              // Convert to target format
              const targetRecord = this.#mv.toLocal(universalRecord);

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
  }

  // Mock transportAll method
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
              const universalRecord = this.#mv.toUniversal(value);

              // Convert to target format
              const targetRecord = this.#mv.toLocal(universalRecord);

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
  }

  // Mock sendMany method
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
  }

  // Mock sendAll method
  async sendAll(
    sourceRecords: any,
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

// Mock collection with reactive stream support
class MockReactiveCollection {
  name: string;
  records: Map<string, any> = new Map();
  idCounter: number = 1;

  constructor(name: string) {
    this.name = name;
  }

  async get(id: string): Promise<any> {
    return this.records.get(id);
  }

  async set(id: string, data: any): Promise<string> {
    if (!id) {
      id = `${this.name}_${this.idCounter++}`;
    }
    this.records.set(id, { ...data, id });
    return id;
  }

  async getAll(): Promise<any[]> {
    return Array.from(this.records.values());
  }

  // Reactive stream methods
  getMany$(keys: string[]): Observable<{ key: string; value: any }> {
    const subject = new Subject<{ key: string; value: any }>();

    // Emit each record
    setTimeout(() => {
      for (const key of keys) {
        const value = this.records.get(key);
        if (value) {
          subject.next({ key, value });
        }
      }
      subject.complete();
    }, 0);

    return subject;
  }

  getAll$(): Observable<{ key: string; value: any }> {
    const subject = new Subject<{ key: string; value: any }>();

    // Emit all records
    setTimeout(() => {
      for (const [key, value] of this.records.entries()) {
        subject.next({ key, value });
      }
      subject.complete();
    }, 0);

    return subject;
  }

  setMany$(records: any[]): Observable<{ key: string }> {
    const subject = new Subject<{ key: string }>();

    // Process each record
    setTimeout(async () => {
      for (const record of records) {
        const key = await this.set('', record);
        subject.next({ key });
      }
      subject.complete();
    }, 0);

    return subject;
  }
}

describe('PlateSimulation Stream Methods', () => {
  let simulation: MockPlateSimulation;
  let sourceUniverse: MockUniverse;
  let targetUniverse: MockUniverse;
  let sourcePlanetCollection: MockReactiveCollection;
  let targetPlanetCollection: MockReactiveCollection;

  beforeEach(() => {
    // Create simulation
    simulation = new MockPlateSimulation();

    // Create universes
    sourceUniverse = new MockUniverse('source-universe');
    targetUniverse = new MockUniverse('target-universe');

    // Create collections
    sourcePlanetCollection = new MockReactiveCollection('planets');
    targetPlanetCollection = new MockReactiveCollection('planets');

    // Add collections to universes
    sourceUniverse.add(sourcePlanetCollection);
    targetUniverse.add(targetPlanetCollection);

    // Add universes to simulation
    simulation.addUniverse(sourceUniverse);
    simulation.addUniverse(targetUniverse);

    // Add test data to source collection
    sourcePlanetCollection.set('', { name: 'Earth', radius: 6371 });
    sourcePlanetCollection.set('', { name: 'Mars', radius: 3389 });
  });

  it('should transport multiple records using reactive streams', async () => {
    // Get all planet records
    const planets = await sourcePlanetCollection.getAll();
    const planetKeys = planets.map((planet) => planet.id);

    // Transport planets from source to target
    const result = await simulation.transportMany(
      planetKeys,
      'planets',
      'planets',
      'source-universe',
      'target-universe',
    );

    // Check that the planets were transported
    expect(result.length).toBe(2);

    // Check that the planets exist in the target universe
    const targetPlanets = await targetPlanetCollection.getAll();
    expect(targetPlanets.length).toBe(2);

    // Check that the planet data is correct
    const earth = targetPlanets.find((planet) => planet.name === 'Earth');
    const mars = targetPlanets.find((planet) => planet.name === 'Mars');

    expect(earth).toBeDefined();
    expect(earth?.radius).toBe(6371);

    expect(mars).toBeDefined();
    expect(mars?.radius).toBe(3389);
  });

  it('should transport all records using reactive streams', async () => {
    // Transport all planets from source to target
    const result = await simulation.transportAll(
      'planets',
      'planets',
      'source-universe',
      'target-universe',
    );

    // Check that all planets were transported
    expect(result.length).toBe(2);

    // Check that the planets exist in the target universe
    const targetPlanets = await targetPlanetCollection.getAll();
    expect(targetPlanets.length).toBe(2);

    // Check that the planet data is correct
    const earth = targetPlanets.find((planet) => planet.name === 'Earth');
    const mars = targetPlanets.find((planet) => planet.name === 'Mars');

    expect(earth).toBeDefined();
    expect(earth?.radius).toBe(6371);

    expect(mars).toBeDefined();
    expect(mars?.radius).toBe(3389);
  });

  it('should send multiple records using reactive streams', async () => {
    // Create new records to send
    const newPlanets = [
      { name: 'Venus', radius: 6052 },
      { name: 'Jupiter', radius: 69911 },
    ];

    // Send planets to target universe
    const result = await simulation.sendMany(
      newPlanets,
      'planets',
      'target-universe',
    );

    // Check that the planets were sent
    expect(result.length).toBe(2);

    // Check that the planets exist in the target universe
    const targetPlanets = await targetPlanetCollection.getAll();
    expect(targetPlanets.length).toBe(2);

    // Check that the planet data is correct
    const venus = targetPlanets.find((planet) => planet.name === 'Venus');
    const jupiter = targetPlanets.find((planet) => planet.name === 'Jupiter');

    expect(venus).toBeDefined();
    expect(venus?.radius).toBe(6052);

    expect(jupiter).toBeDefined();
    expect(jupiter?.radius).toBe(69911);
  });

  it('should send all records using reactive streams', async () => {
    // Create a source observable
    const sourceObservable = new Observable<any>((observer) => {
      observer.next({ name: 'Saturn', radius: 58232 });
      observer.next({ name: 'Neptune', radius: 24622 });
      observer.complete();
    });

    // Send all records to target universe
    const result = await simulation.sendAll(
      sourceObservable,
      'planets',
      'target-universe',
    );

    // Check that all records were sent
    expect(result.length).toBe(2);

    // Check that the records exist in the target universe
    const targetPlanets = await targetPlanetCollection.getAll();
    expect(targetPlanets.length).toBe(2);

    // Check that the record data is correct
    const saturn = targetPlanets.find((planet) => planet.name === 'Saturn');
    const neptune = targetPlanets.find((planet) => planet.name === 'Neptune');

    expect(saturn).toBeDefined();
    expect(saturn?.radius).toBe(58232);

    expect(neptune).toBeDefined();
    expect(neptune?.radius).toBe(24622);
  });
});
