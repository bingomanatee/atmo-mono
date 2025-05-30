/**
 * Schema Definitions for Worker Management System
 */

import { FIELD_TYPES } from '@wonderlandlabs/multiverse';
import { WORKER_COLLECTIONS } from './multiverse/WorkerUniverse';

// ─── Core Entity Schemas ───────────────────────────────────────────

export const BankSchema = {
  name: 'Bank',
  description: 'Worker bank entity schema',
  fields: {
    bankId: {
      type: FIELD_TYPES.string,
      description: 'Unique bank identifier',
    },
    name: {
      type: FIELD_TYPES.string,
      description: 'Human-readable bank name',
    },
    description: {
      type: FIELD_TYPES.string,
      description: 'Bank description',
    },
    manifestName: {
      type: FIELD_TYPES.string,
      description: 'Worker manifest name',
    },
    workerCount: {
      type: FIELD_TYPES.number,
      description: 'Number of workers in this bank',
    },
    status: {
      type: FIELD_TYPES.string,
      description: 'Bank status',
    },
    config: {
      type: FIELD_TYPES.object,
      description: 'Bank configuration',
    },
    createdAt: {
      type: FIELD_TYPES.string,
      description: 'When bank was created (ISO string)',
    },
    updatedAt: {
      type: FIELD_TYPES.string,
      description: 'When bank was last updated (ISO string)',
    },
    metrics: {
      type: FIELD_TYPES.object,
      description: 'Bank performance metrics',
    },
  },
};

export const TaskDefinitionSchema = {
  name: 'TaskDefinition',
  description: 'Task definition entity schema',
  fields: {
    taskId: {
      type: FIELD_TYPES.string,
      description: 'Unique task identifier',
    },
    actionId: {
      type: FIELD_TYPES.string,
      description: 'Task action ID from manifest',
    },
    name: {
      type: FIELD_TYPES.string,
      description: 'Human-readable task name',
    },
    description: {
      type: FIELD_TYPES.string,
      description: 'Task description',
    },
    category: {
      type: FIELD_TYPES.string,
      description: 'Task category',
    },
    estimatedDuration: {
      type: FIELD_TYPES.number,
      description: 'Expected processing time in milliseconds',
    },
    parametersSchema: {
      type: FIELD_TYPES.object,
      description: 'Task parameters schema',
    },
    createdAt: {
      type: FIELD_TYPES.string,
      description: 'When task was defined (ISO string)',
    },
  },
};

export const RequestSchema = {
  name: 'Request',
  description: 'Request entity schema',
  fields: {
    requestId: {
      type: FIELD_TYPES.string,
      description: 'Unique request identifier',
    },
    taskId: {
      type: FIELD_TYPES.string,
      description: 'Task being requested',
    },
    parameters: {
      type: FIELD_TYPES.object,
      description: 'Request parameters',
    },
    status: {
      type: FIELD_TYPES.string,
      description: 'Current request status',
    },
    priority: {
      type: FIELD_TYPES.number,
      description: 'Priority level (1-10, 10 = highest)',
    },
    clientId: {
      type: FIELD_TYPES.string,
      description: 'Client/source that made the request',
    },
    createdAt: {
      type: FIELD_TYPES.string,
      description: 'When request was created (ISO string)',
    },
    updatedAt: {
      type: FIELD_TYPES.string,
      description: 'When request was last updated (ISO string)',
    },
    metadata: {
      type: FIELD_TYPES.object,
      optional: true,
      description: 'Request metadata',
    },
  },
};

export const RequestAssignmentSchema = {
  name: 'RequestAssignment',
  description: 'Request assignment entity schema',
  fields: {
    assignmentId: {
      type: FIELD_TYPES.string,
      description: 'Unique assignment ID',
    },
    requestId: {
      type: FIELD_TYPES.string,
      description: 'Request being assigned',
    },
    bankId: {
      type: FIELD_TYPES.string,
      description: 'Bank assigned to handle request',
    },
    workerId: {
      type: FIELD_TYPES.string,
      optional: true,
      description: 'Specific worker ID if known',
    },
    createdAt: {
      type: FIELD_TYPES.string,
      description: 'When assignment was created (ISO string)',
    },
    queuedAt: {
      type: FIELD_TYPES.string,
      optional: true,
      description: 'When assignment was queued (ISO string)',
    },
    assignedAt: {
      type: FIELD_TYPES.string,
      optional: true,
      description: 'When assignment was made (ISO string)',
    },
    startedAt: {
      type: FIELD_TYPES.string,
      optional: true,
      description: 'When processing started (ISO string)',
    },
    completedAt: {
      type: FIELD_TYPES.string,
      optional: true,
      description: 'When processing completed (ISO string)',
    },
    status: {
      type: FIELD_TYPES.string,
      description: 'Assignment status',
    },
    estimatedCompletionAt: {
      type: FIELD_TYPES.string,
      optional: true,
      description: 'Estimated completion time (ISO string)',
    },
    processingDuration: {
      type: FIELD_TYPES.number,
      optional: true,
      description: 'Actual processing duration in milliseconds',
    },
    queuePosition: {
      type: FIELD_TYPES.number,
      optional: true,
      description: 'Position in queue for backlogged requests',
    },
  },
};

// ─── Schema Registry ───────────────────────────────────────────────

export const SCHEMA_REGISTRY = {
  [WORKER_COLLECTIONS.BANKS]: BankSchema,
  [WORKER_COLLECTIONS.TASKS]: TaskDefinitionSchema,
  [WORKER_COLLECTIONS.REQUESTS]: RequestSchema,
  [WORKER_COLLECTIONS.ASSIGNMENTS]: RequestAssignmentSchema,
} as const;

export type SchemaName = keyof typeof SCHEMA_REGISTRY;

/**
 * Get schema by name
 */
export function getSchema(name: SchemaName) {
  return SCHEMA_REGISTRY[name];
}

/**
 * Get all available schema names
 */
export function getSchemaNames(): SchemaName[] {
  return Object.keys(SCHEMA_REGISTRY) as SchemaName[];
}
