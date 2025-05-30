// Simple test to check platelet generation
const { PlateSimulation } = require('./dist/index.js');
const { EARTH_RADIUS } = require('@wonderlandlabs/atmo-utils');
const { Vector3 } = require('three');

async function testPlateletGeneration() {
  console.log('🧪 Testing platelet generation...');
  
  // Create simulation with no auto-generated plates
  const sim = new PlateSimulation({
    planetRadius: EARTH_RADIUS,
    plateCount: 0,
  });
  
  await sim.init();
  console.log('✅ Simulation initialized');
  
  // Add a large plate that should generate many platelets
  const plateId = await sim.addPlate({
    radius: Math.PI / 8, // Large radius (22.5 degrees)
    density: 2.8,
    thickness: 35,
    planetId: sim.planet.id,
  });
  
  console.log(`✅ Added large plate: ${plateId}`);
  
  // Generate platelets
  const plateletManager = sim.managers.get('plateletManager');
  console.log('🔄 Generating platelets...');
  
  const platelets = await plateletManager.generatePlatelets(plateId);
  console.log(`📊 Generated ${platelets.length} platelets`);
  
  // Check collection count
  const plateletsCollection = sim.simUniv.get('platelets');
  const collectionCount = await plateletsCollection.count();
  console.log(`📊 Collection contains ${collectionCount} platelets`);
  
  // Get the plate to check its properties
  const plate = await sim.getPlate(plateId);
  console.log(`📊 Plate radius: ${plate.radius} radians (${(plate.radius * 180 / Math.PI).toFixed(2)}°)`);
  console.log(`📊 Plate position: (${plate.position.x.toFixed(2)}, ${plate.position.y.toFixed(2)}, ${plate.position.z.toFixed(2)})`);
  
  if (platelets.length === 0) {
    console.log('❌ No platelets generated - there might be an issue with the generation logic');
  } else if (platelets.length === 1) {
    console.log('⚠️ Only 1 platelet generated - this seems too few for a large plate');
  } else {
    console.log(`✅ Generated ${platelets.length} platelets - this looks good!`);
  }
}

testPlateletGeneration().catch(console.error);
