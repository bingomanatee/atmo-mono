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

// Create a new Multiverse class for testing
class TestMultiverse extends Multiverse {
  constructor() {
    super(new Map());
  }
}

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

// Create a PlateSimulationWithApi class for testing
class PlateSimulationWithApi {
  apiUniverse: Universe;
  apiClient: MockApiClient;
  multiverse: Multiverse;

  constructor(apiClient: MockApiClient) {
    this.apiClient = apiClient;

    // Create a new multiverse for testing
    this.multiverse = new TestMultiverse();

    // Create API universe
    this.apiUniverse = new Universe('api-universe', this.multiverse);

    // Add API collections
    this.setupApiCollections();

    // Add API universe to multiverse
    this.multiverse.add(this.apiUniverse);
  }

  setupApiCollections() {
    // Create schema for planets
    const planetSchema = new SchemaLocal('planets', {
      id: FIELD_TYPES.string,
      name: FIELD_TYPES.string,
      radius: FIELD_TYPES.number,
    });

    // Create async collection for planets
    const planetCollection = new CollAsync({
      name: 'planets',
      universe: this.apiUniverse,
      schema: planetSchema,
      get: async (id: string) => {
        return this.apiClient.getSimulation(id);
      },
      set: async (id: string, data: any) => {
        if (id) {
          await this.apiClient.saveSimulation(id, data);
          return id;
        } else {
          return this.apiClient.createSimulation(data);
        }
      },
      getAll: async () => {
        return Object.values(this.apiClient.simulations);
      },
    });

    // Create schema for plates
    const plateSchema = new SchemaLocal('plates', {
      id: FIELD_TYPES.string,
      name: FIELD_TYPES.string,
      position: FIELD_TYPES.object,
      'position.x': {
        type: FIELD_TYPES.number,
        universalName: 'x',
        exportOnly: true,
      },
      'position.y': {
        type: FIELD_TYPES.number,
        universalName: 'y',
        exportOnly: true,
      },
      'position.z': {
        type: FIELD_TYPES.number,
        universalName: 'z',
        exportOnly: true,
      },
      radius: FIELD_TYPES.number,
      density: FIELD_TYPES.number,
      thickness: FIELD_TYPES.number,
    });

    // Create async collection for plates
    const plateCollection = new CollAsync({
      name: 'plates',
      universe: this.apiUniverse,
      schema: plateSchema,
      get: async (id: string) => {
        return this.apiClient.getPlate(id);
      },
      set: async (id: string, data: any) => {
        if (id) {
          await this.apiClient.savePlate(id, data);
          return id;
        } else {
          return this.apiClient.createPlate(data);
        }
      },
      getAll: async () => {
        return Object.values(this.apiClient.plates);
      },
    });

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

describe('PlateSimulation with API Universe', () => {
  let apiClient: MockApiClient;
  let simulation: PlateSimulationWithApi;

  beforeEach(() => {
    apiClient = new MockApiClient();
    simulation = new PlateSimulationWithApi(apiClient);
  });

  it('should create a simulation in the API universe', async () => {
    const id = await simulation.addSimulation('Earth', 6371);

    // Check that the simulation was created in the API client
    expect(apiClient.simulations[id]).toBeDefined();
    expect(apiClient.simulations[id].name).toBe('Earth');
    expect(apiClient.simulations[id].radius).toBe(6371);
  });

  it('should create a plate in the API universe', async () => {
    const id = await simulation.addPlate({
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
    const id = await simulation.addSimulation('Mars', 3389);

    // Update the simulation
    await simulation.saveSimulation(id, { radius: 3390 });

    // Check that the simulation was updated in the API client
    expect(apiClient.simulations[id].radius).toBe(3390);
    expect(apiClient.simulations[id].name).toBe('Mars');
  });

  it('should update a plate in the API universe', async () => {
    // Create a plate
    const id = await simulation.addPlate({
      name: 'Pacific Plate',
      position: { x: 4, y: 5, z: 6 },
      radius: 200,
      density: 3.0,
      thickness: 150,
    });

    // Update the plate
    await simulation.savePlate(id, {
      position: { x: 7, y: 8, z: 9 },
    });

    // Check that the plate was updated in the API client
    expect(apiClient.plates[id].x).toBe(7);
    expect(apiClient.plates[id].y).toBe(8);
    expect(apiClient.plates[id].z).toBe(9);
    expect(apiClient.plates[id].name).toBe('Pacific Plate');
  });
});
