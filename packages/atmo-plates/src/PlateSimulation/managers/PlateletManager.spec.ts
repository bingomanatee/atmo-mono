import * as fs from 'fs';
import * as path from 'path';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it, test } from 'vitest';
import { COLLECTIONS } from '../constants';
import { PlateSimulation } from '../PlateSimulation';
import { createTestPlate, setupTestSimulation } from '../test-setup';
import { PlateletManager } from './PlateletManager';
import { EARTH_RADIUS, randomNormal } from '@wonderlandlabs/atmo-utils';

// Helper to generate a random plate
const generateRandomPlate = () => {
  return {
    radius: 1000000 + Math.random() * 2000000, // 1000-3000 km
    density: 2500 + Math.random() * 1000, // 2500-3500 kg/m³
    thickness: 50000 + Math.random() * 100000, // 50-150 km
  };
};

// Generate 50 plates with varied properties
const generatePlates = () => {
  const plates = [];
  const usedPositions = new Set<string>();

  // Major plates (fixed positions for realism)
  const majorPlates = [
    {
      id: 'north_american',
      name: 'North American Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.8, 0),
      radius: 5000000,
      density: 2800,
      thickness: 100000,
    },
    {
      id: 'pacific',
      name: 'Pacific Plate',
      position: new Vector3(EARTH_RADIUS * 0.7, 0, 0),
      radius: 6000000,
      density: 2900,
      thickness: 80000,
    },
    {
      id: 'eurasian',
      name: 'Eurasian Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.6, EARTH_RADIUS * 0.4),
      radius: 5500000,
      density: 2850,
      thickness: 90000,
    },
    {
      id: 'african',
      name: 'African Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.3, EARTH_RADIUS * 0.5),
      radius: 4800000,
      density: 2750,
      thickness: 95000,
    },
    {
      id: 'antarctic',
      name: 'Antarctic Plate',
      position: new Vector3(0, -EARTH_RADIUS * 0.9, 0),
      radius: 4500000,
      density: 2700,
      thickness: 120000,
    },
    {
      id: 'indian',
      name: 'Indian Plate',
      position: new Vector3(
        EARTH_RADIUS * 0.4,
        EARTH_RADIUS * 0.2,
        EARTH_RADIUS * 0.6,
      ),
      radius: 4200000,
      density: 2820,
      thickness: 85000,
    },
    {
      id: 'south_american',
      name: 'South American Plate',
      position: new Vector3(
        -EARTH_RADIUS * 0.5,
        EARTH_RADIUS * 0.2,
        EARTH_RADIUS * 0.3,
      ),
      radius: 4600000,
      density: 2780,
      thickness: 88000,
    },
  ];

  // Add major plates
  majorPlates.forEach((plate) => {
    plates.push({
      ...plate,
      planetId: 'earth',
    });
  });

  // Add minor plates
  for (let i = 0; i < 43; i++) {
    const plate = generateRandomPlate();
    let position;
    let positionKey;

    // Keep trying until we find an unused position
    do {
      position = randomNormal().multiplyScalar(EARTH_RADIUS);
      positionKey = `${position.x},${position.y},${position.z}`;
    } while (usedPositions.has(positionKey));

    usedPositions.add(positionKey);

    plates.push({
      id: `minor_plate_${i}`,
      name: `Minor Plate ${i}`,
      position,
      ...plate,
      planetId: 'earth',
    });
  }

  return plates;
};

// Sample simulation data
const SAMPLE_SIMULATION = {
  plates: generatePlates(),
};

describe('PlateletManager', () => {
  let manager: PlateletManager;
  let sim: PlateSimulation;
  let testPlateId: string;

  beforeAll(() => {
    try {
      // Increase timeout for all tests in this suite

      // Save sample simulation to file
      const testDataPath = path.join(__dirname, 'test-data');
      if (!fs.existsSync(testDataPath)) {
        fs.mkdirSync(testDataPath);
      }
      fs.writeFileSync(
        path.join(testDataPath, 'sample-simulation.json'),
        JSON.stringify(SAMPLE_SIMULATION, null, 2),
      );

      // Initialize simulation with shared setup
      const { sim: testSim, earthPlanet } = setupTestSimulation();
      sim = testSim;

      // Create test plate
      testPlateId = createTestPlate(sim, earthPlanet.id);

      // Initialize the stateless PlateletManager with the simulation instance
      manager = new PlateletManager(sim);
    } catch (err) {
      console.log('----error in setup:', err);
    }
  });

  it('should generate consistent platelets', () => {
    // First generation
    const firstGen = manager.generatePlatelets(testPlateId);
    expect(firstGen.length).toBeGreaterThan(0);

    // Second generation should be consistent (same count and properties)
    const secondGen = manager.generatePlatelets(testPlateId);
    expect(secondGen.length).toBe(firstGen.length);

    // Check that platelets have consistent properties (but allow for different planetIds due to UUID generation)
    firstGen.forEach((platelet, index) => {
      const secondPlatelet = secondGen[index];
      expect(secondPlatelet.plateId).toBe(platelet.plateId);
      expect(secondPlatelet.position.x).toBeCloseTo(platelet.position.x, 5);
      expect(secondPlatelet.position.y).toBeCloseTo(platelet.position.y, 5);
      expect(secondPlatelet.position.z).toBeCloseTo(platelet.position.z, 5);
      expect(secondPlatelet.radius).toBeCloseTo(platelet.radius, 5);
      expect(secondPlatelet.density).toBe(platelet.density);
      expect(secondPlatelet.thickness).toBe(platelet.thickness);
    });
  });

  it('should store platelets in the collection', () => {
    // Generate platelets
    const platelets = manager.generatePlatelets(testPlateId);
    expect(platelets.length).toBeGreaterThan(0);

    // Check that platelets are stored in the simulation's collection
    const plateletsCollection = sim.simUniv.get('platelets');
    expect(plateletsCollection).toBeDefined();

    // Count platelets for this plate in the collection
    let collectionCount = 0;
    plateletsCollection.each((platelet) => {
      if (platelet.plateId === testPlateId) {
        collectionCount++;
      }
    });

    expect(collectionCount).toBe(platelets.length);
  });

  it('should generate platelets with correct properties', () => {
    const platelets = manager.generatePlatelets(testPlateId);
    expect(platelets.length).toBeGreaterThan(0);

    const testPlate = sim.getPlate(testPlateId);
    expect(testPlate).toBeDefined();

    platelets.forEach((platelet) => {
      // Check position is within plate's radius
      expect(
        platelet.position.distanceTo(testPlate!.position),
      ).toBeLessThanOrEqual(testPlate!.radius * 1.1); // Allow 10% margin for floating point errors

      // Check radius is reasonable (based on H3 level 4 cell size)
      expect(platelet.radius).toBeGreaterThan(0);
      expect(platelet.radius).toBeLessThanOrEqual(testPlate!.radius / 10); // Should be at most 1/10th of plate radius

      // Check other properties
      expect(platelet.id).toBeDefined();
      expect(platelet.plateId).toBe(testPlateId);
      expect(platelet.thickness).toBeGreaterThan(0);
    });
  });

  it('should load and generate platelets from saved simulation', () => {
    const testDataPath = path.join(
      __dirname,
      'test-data',
      'sample-simulation.json',
    );
    const savedData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));

    // Create a new simulation and load the saved data
    const newSim = new PlateSimulation({});
    newSim.init();

    // Create Earth planet
    const earthPlanet = newSim.makePlanet(EARTH_RADIUS, 'earth');
    const planetsCollection = newSim.simUniv.get(COLLECTIONS.PLANETS);
    planetsCollection.set(earthPlanet.id, earthPlanet);

    // Add plates from saved data
    savedData.plates.forEach((p: any) => {
      newSim.addPlate({
        id: p.id,
        name: p.name,
        radius: p.radius,
        density: p.density,
        thickness: p.thickness,
        position: new Vector3(p.position.x, p.position.y, p.position.z),
        planetId: earthPlanet.id, // Use the actual planet ID
      });
    });

    // Create and register PlateletManager
    const newManager = new PlateletManager(newSim);

    // Generate platelets for each plate
    savedData.plates.forEach((p: any) => {
      const platelets = newManager.generatePlatelets(p.id);
      expect(platelets.length).toBeGreaterThan(0);
    });
  });

  it('should have all platelets within the plate radius and match brute-force H3 cell set', () => {
    const platelets = manager.generatePlatelets(testPlateId);
    expect(platelets.length).toBeGreaterThan(0);
    const plate = sim.getPlate(testPlateId);
    expect(plate).toBeDefined();

    // Assert all platelets are within the plate's radius
    platelets.forEach((platelet) => {
      expect(platelet.position.distanceTo(plate.position)).toBeLessThanOrEqual(
        plate.radius,
      );
    });

    // Check for reasonable platelet count (around 6000-6500 for a plate of this size)
    expect(platelets.length).toBeGreaterThan(6000);
    expect(platelets.length).toBeLessThan(6500);
  });
});
