/**
 * Atmo Plates - A plate tectonics simulation library
 * @packageDocumentation
 */

// Export main classes
export { PlateSimulation } from './PlateSimulation/PlateSimulation';
export { PlateletManager } from './PlateSimulation/managers/PlateletManager';
export { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
export { PlateSpectrumGenerator } from './generator/PlateSpectrumGenerator';

// Export storage classes
export {
  DexieSun,
  IndexedSun,
  createAsyncSun,
  createDexieSun,
  createMemoryAsyncSun,
  getStorageCapabilities,
} from './PlateSimulation/sun';

// Export types
export type { Plate } from './PlateSimulation/PlateSimulation';
export type { SimPlateIF } from './PlateSimulation/types.PlateSimulation';
export * from './workers/platelet-worker';
