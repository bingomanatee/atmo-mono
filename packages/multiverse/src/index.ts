/**
 * Multiverse - A synchronization system for sending records and signals between multiple scopes
 * @packageDocumentation
 */

// Core classes
export { Multiverse } from './Multiverse';
export { Universe } from './Universe';
export { CollSync } from './collections/CollSync';
export { CollAsync } from './collections/CollAsync';
export { SchemaLocal } from './SchemaLocal';
export { SchemaUniversal } from './SchemaUniversal';

// Sun implementations
export { SunBase } from './suns/SunFBase';
export { SunMemory } from './suns/SunMemory';
export { SunMemoryAsync } from './suns/SunMemoryAsync';
export { SunMemoryImmer } from './suns/SunMemoryImmer';
export { SunMemoryImmerAsync } from './suns/SunMemoryImmerAsync';

export * from './suns/SunMemory';
export * from './suns/SunMemoryAsync';
export * from './suns/SunMemoryImmer';

// Constants
export { FIELD_TYPES, MUTATION_ACTIONS } from './constants';

// Type exports
export * from './types.multiverse';
export * from './types.coll';
export * from './type.schema';

// Utility functions
export * from './typeguards.multiverse';
export * from './utils/validateField';
export * from './utils/deGenerateMaps';
