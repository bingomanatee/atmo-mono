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

// Mock API client for async universe
class MockApiClient {
  simulations: Record<string, any> = {};
  plates: Record<string, any> = {};

  async createSimulation(data: any): Promise<string> {
    const id = `sim_${Object.keys(this.simulations).length + 1}`;
    this.simulations[id] = { ...data, id };
    return id;
  }

  async createPlate(data: any): Promise<string> {
    const id = `plate_${Object.keys(this.plates).length + 1}`;
    this.plates[id] = { ...data, id };
    return id;
  }

  async saveSimulation(id: string, data: any): Promise<void> {
    if (!this.simulations[id]) {
      throw new Error(`Simulation with ID ${id} not found`);
    }
    this.simulations[id] = { ...this.simulations[id], ...data };
  }

  async savePlate(id: string, data: any): Promise<void> {
    if (!this.plates[id]) {
      throw new Error(`Plate with ID ${id} not found`);
    }
    this.plates[id] = { ...this.plates[id], ...data };
  }

  async getSimulation(id: string): Promise<any> {
    return this.simulations[id];
  }

  async getPlate(id: string): Promise<any> {
    return this.plates[id];
  }
}

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

// Create a class to handle API interactions
class ApiUniverseHandler {
  apiUniverse: MockUniverse;
  apiClient: MockApiClient;
  simulation: PlateSimulation;

  constructor(simulation: PlateSimulation, apiClient: MockApiClient) {
    this.simulation = simulation;
    this.apiClient = apiClient;

    // Create API universe
    this.apiUniverse = new MockUniverse('api-universe');

    // Setup API collections
    this.setupApiCollections();

    // Add API universe to the simulation's multiverse
    // In a real scenario, we would add this to the simulation's multiverse
    // this.simulation.addUniverse(this.apiUniverse);
  }

  setupApiCollections() {
    // Create mock collections
    const planetCollection = {
      name: 'planets',
      set: async (id: string, data: any) => {
        if (id) {
          await this.apiClient.saveSimulation(id, data);
          return id;
        } else {
          return this.apiClient.createSimulation(data);
        }
      },
      get: async (id: string) => {
        return this.apiClient.getSimulation(id);
      },
      getAll: async () => {
        return Object.values(this.apiClient.simulations);
      },
    };

    const plateCollection = {
      name: 'plates',
      set: async (id: string, data: any) => {
        if (id) {
          await this.apiClient.savePlate(id, data);
          return id;
        } else {
          return this.apiClient.createPlate(data);
        }
      },
      get: async (id: string) => {
        return this.apiClient.getPlate(id);
      },
      getAll: async () => {
        return Object.values(this.apiClient.plates);
      },
    };

    // Add collections to universe
    this.apiUniverse.add(planetCollection);
    this.apiUniverse.add(plateCollection);
  }

  // Add a simulation to the API universe
  async addSimulation(name: string, radius: number): Promise<string> {
    const planetCollection = this.apiUniverse.getCollection('planets');
    const id = await planetCollection.set('', { name, radius });
    return id;
  }

  // Add a plate to the API universe
  async addPlate(data: {
    name: string;
    position: { x: number; y: number; z: number };
    radius: number;
    density: number;
    thickness: number;
  }): Promise<string> {
    const plateCollection = this.apiUniverse.getCollection('plates');
    const id = await plateCollection.set('', data);
    return id;
  }

  // Save a plate to the API universe
  async savePlate(id: string, data: any): Promise<void> {
    const plateCollection = this.apiUniverse.getCollection('plates');
    await plateCollection.set(id, data);
  }

  // Save a simulation to the API universe
  async saveSimulation(id: string, data: any): Promise<void> {
    const planetCollection = this.apiUniverse.getCollection('planets');
    await planetCollection.set(id, data);
  }
}

// Mock PlateSimulation class for testing
class MockPlateSimulation {
  #mv: Multiverse;

  constructor() {
    this.#mv = new Multiverse(new Map());
  }

  addUniverse(universe: Universe): void {
    this.#mv.add(universe);
  }

  getUniverse(name: string): Universe | undefined {
    return this.#mv.getUniverse(name);
  }
}

describe('PlateSimulation with API Universe', () => {
  let apiClient: MockApiClient;
  let simulation: MockPlateSimulation;
  let apiHandler: ApiUniverseHandler;

  beforeEach(() => {
    apiClient = new MockApiClient();
    simulation = new MockPlateSimulation();
    apiHandler = new ApiUniverseHandler(simulation as any, apiClient);
  });

  it('should create a simulation in the API universe', async () => {
    const id = await apiHandler.addSimulation('Earth', 6371);

    // Check that the simulation was created in the API client
    expect(apiClient.simulations[id]).toBeDefined();
    expect(apiClient.simulations[id].name).toBe('Earth');
    expect(apiClient.simulations[id].radius).toBe(6371);
  });

  it('should create a plate in the API universe', async () => {
    const id = await apiHandler.addPlate({
      name: 'Eurasian Plate',
      position: { x: 1, y: 2, z: 3 },
      radius: 100,
      density: 2.7,
      thickness: 100,
    });

    // Check that the plate was created in the API client
    expect(apiClient.plates[id]).toBeDefined();
    expect(apiClient.plates[id].name).toBe('Eurasian Plate');
    expect(apiClient.plates[id].x).toBe(1);
    expect(apiClient.plates[id].y).toBe(2);
    expect(apiClient.plates[id].z).toBe(3);
    expect(apiClient.plates[id].radius).toBe(100);
    expect(apiClient.plates[id].density).toBe(2.7);
    expect(apiClient.plates[id].thickness).toBe(100);
  });

  it('should update a simulation in the API universe', async () => {
    // Create a simulation
    const id = await apiHandler.addSimulation('Mars', 3389);

    // Update the simulation
    await apiHandler.saveSimulation(id, { radius: 3390 });

    // Check that the simulation was updated in the API client
    expect(apiClient.simulations[id].radius).toBe(3390);
    expect(apiClient.simulations[id].name).toBe('Mars');
  });

  it('should update a plate in the API universe', async () => {
    // Create a plate
    const id = await apiHandler.addPlate({
      name: 'Pacific Plate',
      position: { x: 4, y: 5, z: 6 },
      radius: 200,
      density: 3.0,
      thickness: 150,
    });

    // Update the plate
    await apiHandler.savePlate(id, {
      position: { x: 7, y: 8, z: 9 },
    });

    // Check that the plate was updated in the API client
    expect(apiClient.plates[id].x).toBe(7);
    expect(apiClient.plates[id].y).toBe(8);
    expect(apiClient.plates[id].z).toBe(9);
    expect(apiClient.plates[id].name).toBe('Pacific Plate');
  });
});
