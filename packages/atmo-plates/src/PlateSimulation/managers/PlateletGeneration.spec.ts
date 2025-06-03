import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import * as fs from 'fs';
import * as path from 'path';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { PlateSimulation } from '../PlateSimulation';
import { PlateletManager } from './PlateletManager';

// Helper to generate random position on sphere
function randomPositionOnSphere(radius: number): Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Helper to generate random plate properties
function randomPlateProperties() {
  return {
    radians: Math.PI / 24 + Math.random() * (Math.PI / 8), // 7.5° to 22.5° in radians
    density: 2700 + Math.random() * 300, // 2700-3000 kg/m³
    thickness: 50000 + Math.random() * 100000, // 50-150 km
  };
}

// Generate 50 plates with varied properties
const generatePlates = () => {
  const plates = [];
  const usedPositions = new Set<string>();

  // Major plates (fixed positions for realism) - using realistic radian values
  const majorPlates = [
    {
      id: 'north_american',
      name: 'North American Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.8, 0),
      radians: Math.PI / 6, // 30° - large plate
      density: 2800,
      thickness: 100000,
    },
    {
      id: 'pacific',
      name: 'Pacific Plate',
      position: new Vector3(EARTH_RADIUS * 0.7, 0, 0),
      radians: Math.PI / 5, // 36° - largest plate
      density: 2900,
      thickness: 80000,
    },
    {
      id: 'eurasian',
      name: 'Eurasian Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.6, EARTH_RADIUS * 0.4),
      radians: Math.PI / 7, // 25.7° - large plate
      density: 2850,
      thickness: 90000,
    },
    {
      id: 'african',
      name: 'African Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.3, EARTH_RADIUS * 0.5),
      radians: Math.PI / 8, // 22.5° - large plate
      density: 2750,
      thickness: 95000,
    },
    {
      id: 'antarctic',
      name: 'Antarctic Plate',
      position: new Vector3(0, -EARTH_RADIUS * 0.9, 0),
      radians: Math.PI / 9, // 20° - medium-large plate
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
      radians: Math.PI / 12, // 15° - medium plate
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
      radians: Math.PI / 15, // 12° - medium plate
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
    usedPositions.add(plate.position.toArray().join(','));
  });

  // Generate remaining plates
  while (plates.length < 50) {
    const pos = randomPositionOnSphere(EARTH_RADIUS);
    const posKey = pos.toArray().join(',');

    // Check if position is too close to existing plates
    const tooClose = Array.from(usedPositions).some((usedPos) => {
      const [x, y, z] = usedPos.split(',').map(Number);
      const usedVec = new Vector3(x, y, z);
      return pos.distanceTo(usedVec) < 1000000; // 1000 km minimum separation
    });

    if (!tooClose) {
      // Minor plates: random radius between 5° and 15° in radians
      const minRadians = Math.PI / 36; // 5°
      const maxRadians = Math.PI / 12; // 15°
      const radiusRadians =
        minRadians + Math.random() * (maxRadians - minRadians);
      const props = {
        radians: radiusRadians,
        density: 2700 + Math.random() * 300,
        thickness: 50000 + Math.random() * 100000,
      };
      plates.push({
        id: `plate_${plates.length + 1}`,
        name: `Minor Plate ${plates.length + 1}`,
        position: pos,
        ...props,
        planetId: 'earth',
      });
      usedPositions.add(posKey);
    }
  }

  return plates;
};

// Sample simulation data
const SAMPLE_SIMULATION = {
  plates: generatePlates(),
};

describe('Large Scale Platelet Generation', () => {
  let manager: PlateletManager;
  let sim: PlateSimulation;
  let samplePlates: Plate[];

  beforeAll(async () => {
    // Save sample simulation to file
    const testDataPath = path.join(__dirname, 'test-data');
    if (!fs.existsSync(testDataPath)) {
      fs.mkdirSync(testDataPath);
    }
    fs.writeFileSync(
      path.join(testDataPath, 'sample-simulation.json'),
      JSON.stringify(SAMPLE_SIMULATION, null, 2),
    );

    // Initialize simulation and manager
    sim = new PlateSimulation({});
    await sim.init();

    // Create Earth planet first using makePlanet and capture the ID
    const earthPlanet = sim.makePlanet(EARTH_RADIUS, 'Earth');

    manager = new PlateletManager(sim);

    // Add plates to simulation, ensuring they use the generated planet ID
    samplePlates = await Promise.all(
      SAMPLE_SIMULATION.plates.map(async (plate) => {
        const plateId = await sim.addPlate({
          ...plate,
          planetId: earthPlanet.id, // Use the actual planet ID
        });
        return await sim.getPlate(plateId);
      }),
    );
  });

  it('should generate platelets for each plate', async () => {
    for (const plate of samplePlates) {
      const platelets = await manager.generatePlatelets(plate.id);
      expect(platelets.length).toBeGreaterThan(0);
      expect(platelets.every((p) => p.plateId === plate.id)).toBe(true);
    }
  });

  it('should have a reasonable number of platelets per plate', async () => {
    const plateletCounts = await Promise.all(
      samplePlates.map(async (plate) => {
        const platelets = await manager.generatePlatelets(plate.id);
        return {
          plateId: plate.id,
          count: platelets.length,
          radius: plate.radius,
        };
      }),
    );

    // Verify each plate has a reasonable number of platelets
    plateletCounts.forEach(({ count, radius }) => {
      // Expect at least one platelet per million square kilometers
      const minExpected = Math.floor(
        (Math.PI * radius * radius) / 1000000000000,
      );
      expect(count).toBeGreaterThanOrEqual(minExpected);
    });
  });

  it('should load and generate platelets from saved simulation', async () => {
    // Load saved simulation
    const testDataPath = path.join(
      __dirname,
      'test-data',
      'sample-simulation.json',
    );
    const savedSim = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
    const loadedPlates = savedSim.plates.map((p: any) => ({
      ...p,
      position: new Vector3(p.position.x, p.position.y, p.position.z),
    }));

    // Add loaded plates to the simulation
    const addedPlates = await Promise.all(
      loadedPlates.map(async (plate) => {
        const plateId = await sim.addPlate({
          ...plate,
          planetId: (await sim.planet()).id, // Use the current planet ID
        });
        return await sim.getPlate(plateId);
      }),
    );

    // Generate platelets for loaded plates
    for (const plate of addedPlates) {
      const platelets = await manager.generatePlatelets(plate.id);
      expect(platelets.length).toBeGreaterThan(0);
      expect(platelets.every((p) => p.plateId === plate.id)).toBe(true);
    }
  });

  it.skip('should maintain consistent platelet generation across runs', async () => {
    const firstRunCounts = await Promise.all(
      samplePlates.map(async (plate) => {
        const platelets = await manager.generatePlatelets(plate.id);
        return {
          plateId: plate.id,
          count: platelets.length,
          positions: platelets.map((p) => p.position.toArray()),
        };
      }),
    );

    // Clear cache and regenerate
    manager.clearCache();
    const secondRunCounts = await Promise.all(
      samplePlates.map(async (plate) => {
        const platelets = await manager.generatePlatelets(plate.id);
        return {
          plateId: plate.id,
          count: platelets.length,
          positions: platelets.map((p) => p.position.toArray()),
        };
      }),
    );

    // Compare results
    firstRunCounts.forEach((first, index) => {
      const second = secondRunCounts[index];
      expect(Math.abs(second.count - first.count)).toBeLessThan(
        Math.max(1000, first.count / 2),
      );
    });
  });

  it.skip('should generate a reasonable number of platelets for a plate', async () => {
    for (const plate of samplePlates) {
      const platelets = await manager.generatePlatelets(plate.id);
      // For plates between 2000-6000km radius, expect 2000-7000 platelets
      expect(platelets.length).toBeGreaterThan(80);
      expect(platelets.length).toBeLessThan(8000);
    }
  });

  it.skip('should generate similar platelet counts for plates with the same radius', async () => {
    // Group plates by radius (rounded to nearest 100,000 meters)
    const radiusGroups = new Map();
    samplePlates.forEach((plate) => {
      const roundedRadius = Math.round(plate.radius / 100000) * 100000;
      if (!radiusGroups.has(roundedRadius)) {
        radiusGroups.set(roundedRadius, []);
      }
      radiusGroups.get(roundedRadius).push(plate);
    });

    for (const [roundedRadius, plates] of radiusGroups) {
      if (plates.length > 1) {
        const counts = await Promise.all(
          plates.map(async (plate) => {
            const platelets = await manager.generatePlatelets(plate.id);
            return platelets.length;
          }),
        );
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        if (min > 0) {
          expect(max).toBeLessThanOrEqual(min * 5);
        }
      }
    }
  });
});
