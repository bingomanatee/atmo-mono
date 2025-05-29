import { PlateSimulation } from './PlateSimulation';
import { Vector3 } from 'three';
import { COLLECTIONS } from './constants';
import { PlateletManager } from './managers/PlateletManager';

export const EARTH_RADIUS = 6371000; // meters

export function setupTestSimulation() {
  const sim = new PlateSimulation({});
  sim.init();

  // Create Earth planet
  const earthPlanet = sim.makePlanet(EARTH_RADIUS, 'earth');

  // Add the planet to the simulation
  const planetsCollection = sim.simUniv.get(COLLECTIONS.PLANETS);
  planetsCollection.set(earthPlanet.id, earthPlanet);

  // Register the PlateletManager
  const plateletManager = new PlateletManager(sim);
  // sim.managers.set(COLLECTIONS.PLATELETS, plateletManager); // Removed as it's now handled in init()

  return { sim, earthPlanet };
}

export function createTestPlate(sim: PlateSimulation, earthPlanetId: string) {
  return sim.addPlate({
    id: 'test_plate',
    name: 'Test Plate',
    radius: 5000000, // 5000 km - make sure this matches the test expectations
    density: 2800,
    thickness: 100000, // 100 km
    planetId: earthPlanetId,
  });
}
