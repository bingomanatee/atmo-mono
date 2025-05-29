/**
 * Example: Creating Irregular Plate Edges
 *
 * This example demonstrates how to use the createIrregularPlateEdges() method
 * to make larger plates more realistic by removing edge platelets.
 */

import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import { PlateSimulation } from '../src/PlateSimulation/PlateSimulation';
import { PlateletManager } from '../src/PlateSimulation/managers/PlateletManager';
import { COLLECTIONS } from '../src/PlateSimulation/constants';

// Create a new plate simulation
const sim = new PlateSimulation({
  planetRadius: EARTH_RADIUS,
  plateCount: 0, // We'll add plates manually
});

// Initialize the simulation
sim.init();

// Add a large plate that will generate many platelets
const plateId = sim.addPlate({
  radius: Math.PI / 6, // Large plate (30 degrees)
  density: 2.8,
  thickness: 35,
});

//console.log(`Created plate: ${plateId}`);

// Generate platelets for the plate
const plateletManager = sim.managers.get('plateletManager') as PlateletManager;
const platelets = plateletManager.generatePlatelets(plateId);

// console.log(`Generated ${platelets.length} platelets`);

// Populate neighbor relationships between platelets
sim.populatePlateletNeighbors();

// Get initial platelet count
const plateletsCollection = sim.simUniv.get(COLLECTIONS.PLATELETS);
const initialCount = plateletsCollection.count();

console.log(`Initial platelet count: ${initialCount}`);

// Create irregular edges by deleting edge platelets
sim.createIrregularPlateEdges();

// Get final platelet count
const finalCount = plateletsCollection.count();
const deletedCount = initialCount - finalCount;
const deletionRatio = deletedCount / initialCount;

//console.log(`Final platelet count: ${finalCount}`);
//console.log(`Deleted ${deletedCount} platelets (${(deletionRatio * 100).toFixed(1)}%)`);

// Analyze the remaining platelets
let edgePlatelets = 0;
let interiorPlatelets = 0;

plateletsCollection.each((platelet: any) => {
  if (platelet.neighbors.length <= 2) {
    edgePlatelets++;
  } else {
    interiorPlatelets++;
  }
});

//console.log(`Remaining edge platelets (≤2 neighbors): ${edgePlatelets}`);
//console.log(`Remaining interior platelets (>2 neighbors): ${interiorPlatelets}`);

/**
 * Expected behavior:
 *
 * - If ≤30 platelets: No deletion occurs
 * - If >30 platelets: Deletes 25% of edge platelets (those with fewest neighbors)
 * - If >60 platelets: Deletes 50% of edge platelets AND 50% of their neighbors
 *
 * This creates more irregular, realistic plate boundaries by removing
 * platelets from the edges where plates would naturally be less stable.
 */
