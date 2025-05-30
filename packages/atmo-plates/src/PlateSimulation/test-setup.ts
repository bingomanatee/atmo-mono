import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import { COLLECTIONS } from './constants';
import { PlateletManager } from './managers/PlateletManager';
import { PlateSimulation } from './PlateSimulation';

export async function setupTestSimulation() {
  const sim = new PlateSimulation({});
  await sim.init();

  // Create Earth planet using the simulation's makePlanet method
  // This automatically adds it to the planets collection
  const earthPlanet = sim.makePlanet(EARTH_RADIUS, 'earth');

  // The managers are already initialized in sim.init(), no need to manually create them
  // The collections are already created by simUniverse() in sim.init()

  return { sim, earthPlanet };
}

export async function createTestPlate(
  sim: PlateSimulation,
  earthPlanetId: string,
) {
  return await sim.addPlate({
    id: 'test_plate',
    name: 'Test Plate',
    radius: 5000 / EARTH_RADIUS, // Convert 5000 km to radians
    density: 2800,
    thickness: 100, // 100 km
    planetId: earthPlanetId,
  });
}
