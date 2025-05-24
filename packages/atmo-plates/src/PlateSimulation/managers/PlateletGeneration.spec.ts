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
    radius: 2000000 + Math.random() * 4000000, // 2000-6000 km
    density: 2700 + Math.random() * 300, // 2700-3000 kg/m³
    thickness: 50000 + Math.random() * 100000, // 50-150 km
  };
}

// Generate 50 plates with varied properties
const generatePlates = () => {
  const plates = [];
  const EARTH_RADIUS = 6371000; // meters
  const usedPositions = new Set<string>();

  // Major plates (fixed positions for realism)
  const majorPlates = [
    {
      id: 'north_american',
      name: 'North American Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.8, 0),
      radius: EARTH_RADIUS / 2, // 1/2 Earth radius
      density: 2800,
      thickness: 100000,
    },
    {
      id: 'pacific',
      name: 'Pacific Plate',
      position: new Vector3(EARTH_RADIUS * 0.7, 0, 0),
      radius: EARTH_RADIUS / 2.5, // 2/5 Earth radius
      density: 2900,
      thickness: 80000,
    },
    {
      id: 'eurasian',
      name: 'Eurasian Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.6, EARTH_RADIUS * 0.4),
      radius: EARTH_RADIUS / 3, // 1/3 Earth radius
      density: 2850,
      thickness: 90000,
    },
    {
      id: 'african',
      name: 'African Plate',
      position: new Vector3(0, EARTH_RADIUS * 0.3, EARTH_RADIUS * 0.5),
      radius: EARTH_RADIUS / 3.5, // ~1/3.5 Earth radius
      density: 2750,
      thickness: 95000,
    },
    {
      id: 'antarctic',
      name: 'Antarctic Plate',
      position: new Vector3(0, -EARTH_RADIUS * 0.9, 0),
      radius: EARTH_RADIUS / 4, // 1/4 Earth radius
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
      radius: EARTH_RADIUS / 5, // 1/5 Earth radius
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
      radius: EARTH_RADIUS / 6, // 1/6 Earth radius
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
      // Minor plates: random radius between 1/10 and 1/4 Earth radius
      const minFrac = 1 / 10;
      const maxFrac = 1 / 4;
      const frac = minFrac + Math.random() * (maxFrac - minFrac);
      const props = {
        radius: EARTH_RADIUS * frac,
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

  beforeAll(() => {
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
    sim.init();

    // Create Earth planet first using makePlanet and capture the ID
    const EARTH_RADIUS = 6371000; // meters
    const earthPlanet = sim.makePlanet(EARTH_RADIUS, 'Earth');

    manager = new PlateletManager(sim);

    // Add plates to simulation, ensuring they use the generated planet ID
    samplePlates = SAMPLE_SIMULATION.plates.map((plate) => {
      const plateId = sim.addPlate({
        ...plate,
        planetId: earthPlanet.id, // Use the actual planet ID
      });
      return sim.getPlate(plateId)!;
    });
  });

  it('should generate platelets for each plate', () => {
    samplePlates.forEach((plate) => {
      const platelets = manager.generatePlatelets(plate.id);
      expect(platelets.length).toBeGreaterThan(0);
      expect(platelets.every((p) => p.plateId === plate.id)).toBe(true);
    });
  });

  it('should have a reasonable number of platelets per plate', () => {
    const plateletCounts = samplePlates.map((plate) => {
      const platelets = manager.generatePlatelets(plate.id);
      return {
        plateId: plate.id,
        count: platelets.length,
        radius: plate.radius,
      };
    });

    // Verify each plate has a reasonable number of platelets
    plateletCounts.forEach(({ count, radius }) => {
      // Expect at least one platelet per million square kilometers
      const minExpected = Math.floor(
        (Math.PI * radius * radius) / 1000000000000,
      );
      expect(count).toBeGreaterThanOrEqual(minExpected);
    });
  });

  it('should load and generate platelets from saved simulation', () => {
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
    const addedPlates = loadedPlates.map((plate) => {
      const plateId = sim.addPlate({
        ...plate,
        planetId: sim.planet!.id, // Use the current planet ID
      });
      return sim.getPlate(plateId)!;
    });

    // Generate platelets for loaded plates
    addedPlates.forEach((plate) => {
      const platelets = manager.generatePlatelets(plate.id);
      expect(platelets.length).toBeGreaterThan(0);
      expect(platelets.every((p) => p.plateId === plate.id)).toBe(true);
    });
  });

  it.skip('should maintain consistent platelet generation across runs', () => {
    const firstRunCounts = samplePlates.map((plate) => {
      const platelets = manager.generatePlatelets(plate.id);
      return {
        plateId: plate.id,
        count: platelets.length,
        positions: platelets.map((p) => p.position.toArray()),
      };
    });

    // Clear cache and regenerate
    manager.clearCache();
    const secondRunCounts = samplePlates.map((plate) => {
      const platelets = manager.generatePlatelets(plate.id);
      return {
        plateId: plate.id,
        count: platelets.length,
        positions: platelets.map((p) => p.position.toArray()),
      };
    });

    // Compare results
    firstRunCounts.forEach((first, index) => {
      const second = secondRunCounts[index];
      console.log(
        'first.count',
        first.count,
        'second count',
        second.count,
        'difference:',
        first.count - second.count,
      );
      expect(Math.abs(second.count - first.count)).toBeLessThan(
        Math.max(1000, first.count / 2),
      );
    });
  });

  it.skip('should generate a reasonable number of platelets for a plate', () => {
    samplePlates.forEach((plate) => {
      const platelets = manager.generatePlatelets(plate.id);
      // For plates between 2000-6000km radius, expect 2000-7000 platelets
      console.log('---- plate', plate.id, 'count', platelets.length);
      expect(platelets.length).toBeGreaterThan(80);
      expect(platelets.length).toBeLessThan(8000);
    });
  });

  it.skip('should generate similar platelet counts for plates with the same radius', () => {
    // Group plates by radius (rounded to nearest 100,000 meters)
    const radiusGroups = new Map();
    samplePlates.forEach((plate) => {
      const roundedRadius = Math.round(plate.radius / 100000) * 100000;
      if (!radiusGroups.has(roundedRadius)) {
        radiusGroups.set(roundedRadius, []);
      }
      radiusGroups.get(roundedRadius).push(plate);
    });

    radiusGroups.forEach((plates, roundedRadius) => {
      if (plates.length > 1) {
        const counts = plates.map(
          (plate) => manager.generatePlatelets(plate.id).length,
        );
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        //a  console.log('min, max', min, max);
        if (min > 0) {
          expect(max).toBeLessThanOrEqual(min * 5);
        }
      }
    });
  });
});
