import { Multiverse, Universe, SchemaUniversal, FIELD_TYPES, CollSync } from '@wonderlandlabs/multiverse';
import { PlateSimulation, Plate } from './index';

// Create a multiverse instance
const multiverse = new Multiverse();

// Create a universe
const universe = new Universe('test-universe');

// Create a schema
const schema = new SchemaUniversal<Plate>('plates', {
  id: FIELD_TYPES.string,
  x: FIELD_TYPES.number,
  y: FIELD_TYPES.number,
  z: FIELD_TYPES.number,
  radius: FIELD_TYPES.number,
  density: FIELD_TYPES.number,
  thickness: FIELD_TYPES.number,
});

// Create a plate simulation
const plateSimulation = new PlateSimulation();

// Export for testing
export { multiverse, universe, schema, plateSimulation };
