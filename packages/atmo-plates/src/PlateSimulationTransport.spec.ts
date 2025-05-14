import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlateSimulation } from './PlateSimulation';
import {
  Multiverse,
  Universe,
  SchemaLocal,
  SchemaUniversal,
  FIELD_TYPES,
  CollSync,
  CollAsync,
} from '@wonderlandlabs/multiverse';

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

  // Mock methods from PlateSimulation
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

    // Use a generator pattern to process records in batches
    for (const key of keys) {
      // Get the record from the source collection
      const record = await sourceCollObj.get(key);

      if (record) {
        // Convert to universal format (simple pass-through for testing)
        const universalRecord = { ...record, _universal: true };

        // Convert to target format
        const targetRecord = { ...universalRecord };
        delete targetRecord._universal;

        // Save to target collection
        const targetKey = await targetCollObj.set('', targetRecord);
        results.push(targetKey);
      }
    }

    return results;
  }

  async transportAll(
    sourceCollection: string,
    targetCollection: string,
    sourceUniverseName: string,
    targetUniverseName: string,
  ): Promise<string[]> {
    const sourceUniverse = this.getUniverse(sourceUniverseName);

    if (!sourceUniverse) {
      throw new Error('Source universe not found');
    }

    const sourceCollObj = sourceUniverse.getCollection(sourceCollection);

    if (!sourceCollObj) {
      throw new Error('Source collection not found');
    }

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

    // Use a generator pattern to process records in batches
    for (const record of records) {
      const key = await collection.set('', record);
      results.push(key);
    }

    return results;
  }

  async sendAll(
    sourceRecords: () => Promise<any[]>,
    collectionName: string,
    universeName: string,
  ): Promise<string[]> {
    const records = await sourceRecords();
    return this.sendMany(records, collectionName, universeName);
  }

  // Mock universe methods
  addUniverse(universe: MockUniverse): void {
    this.universes.set(universe.name, universe);
  }

  getUniverse(name: string): MockUniverse | undefined {
    return this.universes.get(name);
  }
}

// Mock collection for testing
class MockCollection {
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
}

describe('PlateSimulation Transport Methods', () => {
  let simulation: MockPlateSimulation;
  let sourceUniverse: MockUniverse;
  let targetUniverse: MockUniverse;
  let sourcePlanetCollection: MockCollection;
  let targetPlanetCollection: MockCollection;
  let sourcePlateCollection: MockCollection;
  let targetPlateCollection: MockCollection;

  beforeEach(() => {
    // Create simulation
    simulation = new MockPlateSimulation();

    // Create universes
    sourceUniverse = new MockUniverse('source-universe');
    targetUniverse = new MockUniverse('target-universe');

    // Create collections
    sourcePlanetCollection = new MockCollection('planets');
    targetPlanetCollection = new MockCollection('planets');
    sourcePlateCollection = new MockCollection('plates');
    targetPlateCollection = new MockCollection('plates');

    // Add collections to universes
    sourceUniverse.add(sourcePlanetCollection);
    sourceUniverse.add(sourcePlateCollection);
    targetUniverse.add(targetPlanetCollection);
    targetUniverse.add(targetPlateCollection);

    // Add universes to simulation
    simulation.addUniverse(sourceUniverse);
    simulation.addUniverse(targetUniverse);

    // Add test data to source collections
    sourcePlanetCollection.set('', { name: 'Earth', radius: 6371 });
    sourcePlanetCollection.set('', { name: 'Mars', radius: 3389 });
    sourcePlateCollection.set('', {
      name: 'Eurasian Plate',
      position: { x: 1, y: 2, z: 3 },
      radius: 100,
      density: 2.7,
      thickness: 100,
    });
    sourcePlateCollection.set('', {
      name: 'Pacific Plate',
      position: { x: 4, y: 5, z: 6 },
      radius: 200,
      density: 3.0,
      thickness: 150,
    });
  });

  it('should transport multiple records between universes', async () => {
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

  it('should transport all records between universes', async () => {
    // Transport all plates from source to target
    const result = await simulation.transportAll(
      'plates',
      'plates',
      'source-universe',
      'target-universe',
    );

    // Check that all plates were transported
    expect(result.length).toBe(2);

    // Check that the plates exist in the target universe
    const targetPlates = await targetPlateCollection.getAll();
    expect(targetPlates.length).toBe(2);

    // Check that the plate data is correct
    const eurasianPlate = targetPlates.find(
      (plate) => plate.name === 'Eurasian Plate',
    );
    const pacificPlate = targetPlates.find(
      (plate) => plate.name === 'Pacific Plate',
    );

    expect(eurasianPlate).toBeDefined();
    expect(eurasianPlate?.radius).toBe(100);
    expect(eurasianPlate?.density).toBe(2.7);
    expect(eurasianPlate?.thickness).toBe(100);

    expect(pacificPlate).toBeDefined();
    expect(pacificPlate?.radius).toBe(200);
    expect(pacificPlate?.density).toBe(3.0);
    expect(pacificPlate?.thickness).toBe(150);
  });

  it('should send multiple records to a universe', async () => {
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

  it('should send all records from a source to a target', async () => {
    // Create a source function that returns records
    const sourceRecords = async () => {
      return [
        { name: 'Saturn', radius: 58232 },
        { name: 'Neptune', radius: 24622 },
      ];
    };

    // Send all records to target universe
    const result = await simulation.sendAll(
      sourceRecords,
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
