// Test script to verify the neighbor expansion algorithm is working
const {
  PlateSimulation,
  PlateletManager,
} = require("./packages/atmo-plates/dist/index.js");
const { EARTH_RADIUS } = require("@wonderlandlabs/atmo-utils");

async function testRingExpansion() {
  console.log(
    "🧪 Testing neighbor expansion algorithm for platelet generation..."
  );

  // Create simulation with no auto-generated plates
  const sim = new PlateSimulation({
    planetRadius: EARTH_RADIUS,
    plateCount: 0,
  });

  await sim.init();
  console.log("✅ Simulation initialized");

  // Add a medium-sized plate to test the uncapped gridDisk
  const plateId = await sim.addPlate({
    radius: Math.PI / 12, // Medium radius (15 degrees)
    density: 2.8,
    thickness: 35,
    planetId: sim.planet.id,
  });

  console.log(`✅ Added MASSIVE plate: ${plateId}`);

  // Generate platelets
  const plateletManager = new PlateletManager(sim);
  console.log("🔄 Generating platelets with neighbor expansion algorithm...");

  const platelets = await plateletManager.generatePlatelets(plateId);
  console.log(`📊 Generated ${platelets.length} platelets`);

  // Check collection count
  const plateletsCollection = sim.simUniv.get("platelets");
  const collectionCount = await plateletsCollection.count();
  console.log(`📊 Collection contains ${collectionCount} platelets`);

  // Get the plate to see its radius
  const plate = await sim.getPlate(plateId);
  console.log(
    `📏 Plate radius: ${plate.radius.toFixed(4)} radians (${(
      (plate.radius * 180) /
      Math.PI
    ).toFixed(1)} degrees)`
  );

  // Calculate expected vs actual
  const plateRadiusKm = plate.radius * EARTH_RADIUS;
  console.log(`📏 Plate radius in km: ${plateRadiusKm.toFixed(1)} km`);

  // Estimate platelet density
  const plateAreaKm2 = Math.PI * plateRadiusKm * plateRadiusKm;
  const plateletDensity = platelets.length / plateAreaKm2;
  console.log(
    `📊 Platelet density: ${plateletDensity.toFixed(6)} platelets/km²`
  );

  console.log("✅ Test complete!");

  return {
    plateId,
    plateletCount: platelets.length,
    plateRadiusKm,
    plateletDensity,
  };
}

// Run the test
testRingExpansion().catch(console.error);
