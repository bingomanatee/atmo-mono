/**
 * Simulation utilities for the visualizer
 * Shows how to use the new injectable PlateSimulation architecture
 */

import { PlateSimulation, createIDBSun } from '@wonderlandlabs/atmo-plates';
import { Universe } from '@wonderlandlabs/multiverse';
import { initializeDatabases } from './databaseUtils';

// Schema definitions for the simulation universe
const SIMULATION_SCHEMA = {
  planets: {
    fields: {
      id: { type: 'string', meta: { index: true } },
      name: { type: 'string' },
      radius: { type: 'number' },
    },
  },
  plates: {
    fields: {
      id: { type: 'string', meta: { index: true } },
      name: { type: 'string' },
      planetId: { type: 'string', meta: { index: true } },
      position: { type: 'object' },
      radius: { type: 'number' },
      density: { type: 'number' },
      thickness: { type: 'number' },
    },
  },
  platelets: {
    fields: {
      id: { type: 'string', meta: { index: true } },
      plateId: { type: 'string', meta: { index: true } },
      planetId: { type: 'string', meta: { index: true } },
      position: { type: 'object' },
      h3Cell: { type: 'string', meta: { index: true } },
      radius: { type: 'number' },
      thickness: { type: 'number' },
      density: { type: 'number' },
    },
  },
  simulations: {
    fields: {
      id: { type: 'string', meta: { index: true } },
      name: { type: 'string' },
      planetId: { type: 'string', meta: { index: true } },
      plateCount: { type: 'number' },
      maxPlateRadius: { type: 'number' },
    },
  },
};

/**
 * Create a simulation universe with proper database setup
 */
export async function createSimulationUniverse(
  options: {
    clearDatabases?: boolean;
    dbName?: string;
  } = {},
): Promise<Universe> {
  const { clearDatabases = true, dbName = 'atmo-plates' } = options;

  // 1. Initialize databases (clear if requested)
  if (clearDatabases) {
    console.log('🔧 Clearing databases before creating universe...');
    await initializeDatabases({ clearExisting: true, dbName });
  }

  // 2. Create universe
  const universe = new Universe();

  // 3. Create collections with IDBSun storage
  for (const [collectionName, schema] of Object.entries(SIMULATION_SCHEMA)) {
    const sun = await createIDBSun({
      dbName,
      tableName: collectionName,
      schema: schema as any,
      isMaster: true, // First instance is master
    });

    universe.set(collectionName, sun);
    console.log(`📦 Created collection: ${collectionName}`);
  }

  console.log('✅ Simulation universe created');
  return universe;
}

/**
 * Create a PlateSimulation with injected universe
 */
export async function createPlateSimulation(
  options: {
    planetRadius?: number;
    plateCount?: number;
    simulationId?: string;
    maxPlateRadius?: number;
    clearDatabases?: boolean;
  } = {},
): Promise<PlateSimulation> {
  const {
    planetRadius,
    plateCount,
    simulationId,
    maxPlateRadius,
    clearDatabases = true,
  } = options;

  // 1. Create universe
  const universe = await createSimulationUniverse({ clearDatabases });

  // 2. Create PlateSimulation with injected universe
  const simulation = new PlateSimulation(universe, {
    planetRadius,
    plateCount,
    simulationId,
    maxPlateRadius,
  });

  // 3. Initialize simulation
  await simulation.init();

  console.log('✅ PlateSimulation created and initialized');
  return simulation;
}

/**
 * Example usage for the visualizer
 */
export async function exampleUsage() {
  try {
    // Option 1: Create simulation with default settings
    const simulation1 = await createPlateSimulation({
      plateCount: 12,
      maxPlateRadius: 1000, // 1000km max radius
      clearDatabases: true,
    });

    // Option 2: Create universe separately and inject it
    const universe = await createSimulationUniverse({ clearDatabases: true });
    const simulation2 = new PlateSimulation(universe, {
      plateCount: 8,
      maxPlateRadius: 800,
    });
    await simulation2.init();

    // Option 3: Share universe between multiple simulations
    const sharedUniverse = await createSimulationUniverse({
      clearDatabases: true,
    });

    const sim1 = new PlateSimulation(sharedUniverse, { plateCount: 6 });
    const sim2 = new PlateSimulation(sharedUniverse, { plateCount: 10 });

    await sim1.init();
    await sim2.init();

    console.log('✅ All simulation examples created successfully');

    return { simulation1, simulation2, sim1, sim2 };
  } catch (error) {
    console.error('❌ Failed to create simulations:', error);
    throw error;
  }
}

/**
 * Get the PlateletManager from a simulation for direct use or worker delegation
 */
export function getPlateletManager(simulation: PlateSimulation) {
  return simulation.managers.get('plateletManager');
}

/**
 * Example of using PlateletManager directly (main thread)
 */
export async function generatePlateletsDirectly(
  simulation: PlateSimulation,
  plateId: string,
) {
  const plateletManager = getPlateletManager(simulation);

  if (!plateletManager) {
    throw new Error('PlateletManager not found in simulation');
  }

  console.log('🔧 Generating platelets in main thread...');
  const platelets = await plateletManager.generatePlatelets(plateId);
  console.log(`✅ Generated ${platelets.length} platelets`);

  return platelets;
}

/**
 * Example of using ContextProvider pattern
 */
export function exampleContextProviderUsage(simulation: PlateSimulation) {
  // PlateSimulation implements ContextProvider
  const context = simulation; // ContextProvider interface

  // Access universe
  console.log('Universe:', context.universe.name);

  // Get managers through context
  const plateletManager = context.getManager('plateletManager');
  const plateManager = context.getManager('plateManager');

  return { context, plateletManager, plateManager };
}

/**
 * Example of preparing for worker delegation with ContextProvider
 */
export function prepareForWorkerDelegation(simulation: PlateSimulation) {
  // In worker, you would create:
  // const context = new LazyContextProvider(universe);

  return {
    context: simulation, // ContextProvider interface
    universeId: simulation.universe.name || 'simulation-universe',
  };
}
