import { PlateSimulation } from "./src/PlateSimulation/PlateSimulation.js";
import { EARTH_RADIUS } from "@wonderlandlabs/atmo-utils";
import { Vector3 } from "three";

async function testAddPlate() {
  console.log("🧪 Testing addPlate method...");

  // Create a new simulation
  const sim = new PlateSimulation({
    planetRadius: EARTH_RADIUS,
    plateCount: 0, // No auto-generated plates
  });

  await sim.init();
  console.log("✅ Simulation initialized");

  // Test adding a plate with specific characteristics
  const plateId = await sim.addPlate({
    name: "Test Plate",
    radius: Math.PI / 12, // 15 degrees
    density: 2.8, // g/cm³
    thickness: 35, // km
    position: new Vector3(EARTH_RADIUS, 0, 0), // On the surface
    planetId: sim.simulation.planetId,
  });

  console.log(`✅ Added plate with ID: ${plateId}`);

  // Retrieve the plate to verify it was created correctly
  const plate = await sim.getPlate(plateId);

  console.log("📊 Plate characteristics:");
  console.log(`  - Name: ${plate.name}`);
  console.log(
    `  - Radius: ${plate.radius} radians (${(
      (plate.radius * 180) /
      Math.PI
    ).toFixed(2)}°)`
  );
  console.log(`  - Density: ${plate.density} g/cm³`);
  console.log(`  - Thickness: ${plate.thickness} km`);
  console.log(
    `  - Position: (${plate.position.x.toFixed(2)}, ${plate.position.y.toFixed(
      2
    )}, ${plate.position.z.toFixed(2)})`
  );
  console.log(
    `  - Position length: ${plate.position
      .length()
      .toFixed(2)} km (should be ~${EARTH_RADIUS})`
  );
  console.log(`  - Planet ID: ${plate.planetId}`);
  console.log(`  - Is Active: ${plate.isActive}`);

  // Verify position is normalized to sphere surface
  const positionLength = plate.position.length();
  const tolerance = 1.0; // 1 km tolerance
  const isOnSurface = Math.abs(positionLength - EARTH_RADIUS) < tolerance;

  console.log(`✅ Position normalized to sphere surface: ${isOnSurface}`);

  if (!isOnSurface) {
    console.log(
      `❌ Position length ${positionLength} is not close to Earth radius ${EARTH_RADIUS}`
    );
  }

  console.log("🎉 addPlate test completed successfully!");
}

testAddPlate().catch(console.error);
