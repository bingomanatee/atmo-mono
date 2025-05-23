export const COLLECTIONS = {
  PLATES: 'plates',
  PLANETS: 'planets',
  PLATELETS: 'platelets',
  STEPS: 'plate_steps',
  PLATELET_STEPS: 'platelet_steps',
  SIMULATIONS: 'simulations',
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;
export type CollectionValue = (typeof COLLECTIONS)[CollectionKey];
