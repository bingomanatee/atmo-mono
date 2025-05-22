import { describe, it, expect, beforeAll } from 'vitest';
import { Vector3 } from 'three';
import { PlateletManager } from './PlateletManager';
import { PlateSimulation } from '../PlateSimulation';
import * as fs from 'fs';
import * as path from 'path';

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
      const props = randomPlateProperties();
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

    // Generate platelets for loaded plates
    loadedPlates.forEach((plate) => {
      const platelets = manager.generatePlatelets(plate.id);
      expect(platelets.length).toBeGreaterThan(0);
      expect(platelets.every((p) => p.plateId === plate.id)).toBe(true);
    });
  });

  it('should maintain consistent platelet generation across runs', () => {
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
      expect(second.count).toBe(first.count);
      expect(second.positions).toEqual(first.positions);
    });
  });
});
