/**
 * Worker Multiverse - Creates multiverse and universe for worker management system
 */

import {
  Multiverse,
  Universe,
  memorySunF,
  CollSync,
  FIELD_TYPES,
  SchemaLocal,
} from '@wonderlandlabs/multiverse';
import { SCHEMA_REGISTRY } from '../schemas';

// ─── Collection Names ──────────────────────────────────────────────

export const WORKER_COLLECTIONS = {
  BANKS: 'Bank',
  TASKS: 'TaskDefinition',
  CAPABILITIES: 'BankTaskCapability',
  REQUESTS: 'Request',
  ASSIGNMENTS: 'RequestAssignment',
  RESULTS: 'RequestResult',
  ERRORS: 'RequestError',
  STATUS_HISTORY: 'RequestStatusHistory',
} as const;

export interface WorkerMultiverseResult {
  multiverse: Multiverse;
  universe: Universe;
}

/**
 * Create worker multiverse and universe
 */
export function createWorkerMultiverse(
  config: { universeName?: string; name?: string } | string = 'workerDefault',
): WorkerMultiverseResult {
  // Handle legacy string parameter or extract universe name from config
  const universeName =
    typeof config === 'string'
      ? config
      : config.universeName || config.name || 'workerDefault';

  const multiverse = new Multiverse(memorySunF);
  const universe = new Universe(universeName, multiverse);

  // Create and add collections with schemas by iterating through WORKER_COLLECTIONS
  Object.entries(WORKER_COLLECTIONS).forEach(([_, schemaName]) => {
    const schema = SCHEMA_REGISTRY[schemaName];
    if (schema) {
      const collection = new CollSync({
        name: schemaName, // Use schema name directly for consistency
        universe,
        schema: new SchemaLocal(schemaName, schema.fields),
      });
      universe.add(collection);
    }
  });

  return {
    multiverse,
    universe,
  };
}
