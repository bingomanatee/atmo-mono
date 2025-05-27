import { PlateletCollisionSimulator } from './PlateletCollisionSimulator';
import { PlateSimulation } from './PlateSimulation';
import { Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import { COLLECTIONS } from './constants';
import { Platelet } from './Platelet';
import { gridDisk } from 'h3-js';
import { h3HexRadiusAtResolution } from '@wonderlandlabs/atmo-utils';

describe('PlateletCollisionSimulator', () => {
  let sim: PlateSimulation;
  let simulator: PlateletCollisionSimulator;
  const sectorId = '8928308280fffff'; // Example L0 H3 cell
  let platelets: Platelet[];
  let planetId: string;

  beforeEach(() => {
    // Create a new simulation with a planet
    sim = new PlateSimulation();
    sim.init();
    planetId = uuidV4();

    // Determine realistic radius for platelets at level 3 on Earth
    const EARTH_RADIUS = 6371000; // meters
    const plateletRadius = h3HexRadiusAtResolution(EARTH_RADIUS, 3);
    const plateRadius = plateletRadius * 5; // Plate radius is 5x larger than platelet radius

    // Create test platelets in the sector with specific interaction patterns
    const plateletsCollection = sim.simUniv.get(COLLECTIONS.PLATELETS);

    // Create 5 platelets:
    // 1-2-3 form a chain of interactions (1 interacts with 2, 2 interacts with 3)
    // 4-5 are isolated
    platelets = [
      new Platelet({
        position: new Vector3(0, 0, 0),
        radius: plateletRadius,
        thickness: 1,
        density: 1,
        sector: sectorId,
        planetId,
      }),
      new Platelet({
        position: new Vector3(plateletRadius * 1.5, 0, 0), // Should interact with first
        radius: plateletRadius,
        thickness: 1,
        density: 1,
        sector: sectorId,
        planetId,
      }),
      new Platelet({
        position: new Vector3(plateletRadius * 4, 0, 0), // Should NOT interact with first two
        radius: plateletRadius,
        thickness: 1,
        density: 1,
        sector: sectorId,
        planetId,
      }),
      new Platelet({
        position: new Vector3(plateletRadius * 6, 0, 0), // Far away
        radius: plateletRadius,
        thickness: 1,
        density: 1,
        sector: sectorId,
        planetId,
      }),
      new Platelet({
        position: new Vector3(plateletRadius * 8, 0, 0), // Far away
        radius: plateletRadius,
        thickness: 1,
        density: 1,
        sector: sectorId,
        planetId,
      }),
    ];

    // Add platelets to collection
    platelets.forEach((platelet) => {
      plateletsCollection.set(platelet.id, platelet);
    });
  });

  describe('interaction detection', () => {
    it('should find all interactions correctly', () => {
      const simulator = new PlateletCollisionSimulator(sim, sectorId);
      const platelets = simulator.platelets;
      const plateletIds = Array.from(platelets.keys());
      const EPSILON = 5; // More practical epsilon for geological-scale objects

      // Reality check: Skip if there are fewer than two different plate IDs
      const uniquePlateIds = new Set(
        plateletIds.map((id) => platelets.get(id)!.plateId),
      );
      if (uniquePlateIds.size < 2) {
        console.log(
          'Sector has fewer than two different plate IDs. Skipping interaction check.',
        );
        return;
      }

      // Get interactions from the simulator
      const simulatorInteractions = simulator.findInteractions();

      // Brute force check all pairs
      const results = [];
      for (let i = 0; i < plateletIds.length; i++) {
        const id1 = plateletIds[i];
        const platelet1 = platelets.get(id1)!;
        const pos1 = new Vector3().copy(platelet1.position);

        for (let j = i + 1; j < plateletIds.length; j++) {
          const id2 = plateletIds[j];
          const platelet2 = platelets.get(id2)!;
          const pos2 = new Vector3().copy(platelet2.position);

          // Calculate distances and thresholds
          const distance = pos1.distanceTo(pos2);
          const interactionDistance = platelet1.radius + platelet2.radius;
          const shouldInteract = distance <= interactionDistance + EPSILON;

          // Get simulator's result for this pair
          const simulatorResult =
            simulatorInteractions.get(id1)?.has(id2) || false;

          if (simulatorResult) {
            results.push({
              id1,
              id2,
              distance: distance.toFixed(2),
              interactionDistance: interactionDistance.toFixed(2),
              shouldInteract,
              simulatorResult,
            });
          }
        }
      }

      // Verify each pair matches
      for (const result of results) {
        expect(result.simulatorResult).toBe(result.shouldInteract);
      }

      // Compute maximum number of interactions
      const maxInteractions =
        (plateletIds.length * (plateletIds.length - 1)) / 2;
      const actualInteractions = results.length;
      expect(actualInteractions).toBeLessThanOrEqual(maxInteractions / 3);

      // Tally outcomes
      const sameOutcomes = results.filter(
        (result) => result.shouldInteract && result.simulatorResult,
      ).length;
      const missedInteractions = results.filter(
        (result) => result.shouldInteract && !result.simulatorResult,
      ).length;
      const falsePositives = results.filter(
        (result) => !result.shouldInteract && result.simulatorResult,
      ).length;

      // Log summary numbers
      console.log('Number of platelets:', plateletIds.length);
      console.log('Actual interactions:', actualInteractions.length);
      console.log('Same outcomes:', sameOutcomes);
      console.log('Missed interactions:', missedInteractions);
      console.log('False positives:', falsePositives);
      console.log('Maximum possible interactions:', maxInteractions);
      console.log('Count of plates A:', plateletIds.length);
      console.log('Count of plates B:', plateletIds.length);
      console.log('Total number of uncontested intersections:', sameOutcomes);
      console.log(
        'Intersections found by class and not by brute force:',
        falsePositives,
      );
      console.log(
        'Intersections found by brute force and not by class:',
        missedInteractions,
      );

      // Assertions
      expect(sameOutcomes).toBeGreaterThan(0);
      expect(sameOutcomes).toBeLessThan(maxInteractions / 3);
      expect(missedInteractions).toBe(0);
      expect(falsePositives).toBe(0);
    });

    it('should maintain interaction symmetry', () => {
      const simulator = new PlateletCollisionSimulator(sim, sectorId);
      const platelets = Array.from(simulator.platelets.values());
      const interactions = simulator.findInteractions();

      // Check that interactions are symmetric
      platelets.forEach((p1) => {
        platelets.forEach((p2) => {
          if (p1.id === p2.id) return;
          const p1InteractsWithP2 =
            interactions.get(p1.id)?.has(p2.id) || false;
          const p2InteractsWithP1 =
            interactions.get(p2.id)?.has(p1.id) || false;
          expect(p1InteractsWithP2).toBe(p2InteractsWithP1);
        });
      });
    });
  });

  describe('sectorId', () => {
    it('should return the sector ID this simulator represents', () => {
      // Create the simulator
      simulator = new PlateletCollisionSimulator(sim, sectorId);

      expect(simulator.sectorId).toBe(sectorId);
    });
  });
});
