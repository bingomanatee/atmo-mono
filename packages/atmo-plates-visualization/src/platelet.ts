import './style.css';
import {
  PlateletManager,
  PlateSimulation,
  PlateSpectrumGenerator,
  type SimPlateIF,
} from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils'; // Use the correct Earth radius in meters
import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlateletVisualizer } from './PlateletVisualizer'; // Corrected import path

console.log('🚀 Platelet visualization script starting...');
console.log('📏 EARTH_RADIUS:', EARTH_RADIUS, 'km (updated from meters)');
console.log('📏 EARTH_RADIUS value:', EARTH_RADIUS, 'km');
console.log('🌍 THREE.js version:', THREE.REVISION);

// Scene setup
console.log('🎬 Setting up Three.js scene...');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
console.log('✅ Scene created');

// Camera setup
console.log('📷 Setting up camera...');
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  1, // Adjusted near clipping plane
  EARTH_RADIUS * 3, // Increased far clipping plane
);
camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS * 1.5, EARTH_RADIUS * 2); // Adjusted camera position
console.log('✅ Camera created at position:', camera.position);

// Renderer setup
console.log('🖥️ Setting up renderer...');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
console.log('✅ Renderer created and added to DOM');

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Enhanced lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Increased intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2); // Increased intensity
directionalLight.position.set(
  EARTH_RADIUS * 2,
  EARTH_RADIUS * 2,
  EARTH_RADIUS * 2,
); // Adjusted position
scene.add(directionalLight);

// Add a second directional light from the opposite side
const backLight = new THREE.DirectionalLight(0xffffff, 1);
backLight.position.set(-EARTH_RADIUS * 5, -EARTH_RADIUS * 5, -EARTH_RADIUS * 5); // Adjusted position
scene.add(backLight);

// Add a helper to visualize the lights (optional, but good for debugging)
const lightHelper = new THREE.DirectionalLightHelper(
  directionalLight,
  EARTH_RADIUS / 2,
); // Adjusted helper size
scene.add(lightHelper);

// Add planet sphere (Earth representation)
const planetGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32); // Use full Earth radius
const planetMaterial = new THREE.MeshPhongMaterial({
  color: 0x2233ff,
  transparent: true,
  opacity: 0.3,
  wireframe: true,
  wireframeLinewidth: 50, // Increased wireframe thickness
});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.set(0, 0, 0); // Set position to origin
scene.add(planet);

// --- Simulation Setup ---
const NUM_PLATES = 60;

// Database cleanup is now handled centrally in the simulation initialization

// Wrap everything in an async function since we need to await sim.init()
async function generateAndVisualizePlatelets() {
  // Database cleanup is now handled centrally in simulation initialization

  // Initialize simulation with 60 plates and shared storage (IDBSun)
  // Using IDBSun for shared IndexedDB access enables:
  // 1. Better performance with Web Workers for platelet generation
  // 2. Shared data access between main thread and workers
  // 3. Consistent data storage across browser tabs/sessions
  const sim = new PlateSimulation({
    planetRadius: EARTH_RADIUS,
    plateCount: NUM_PLATES,
    useSharedStorage: true, // Enable shared storage using IDBSun
  });

  console.log('🔧 Initializing simulation...');
  try {
    console.log('🧹 Clearing existing databases for fresh start...');
    await sim.clearDatabases();
    console.log('✅ Database clearing completed');
    await sim.init();
    console.log('✅ Simulation initialized successfully');

    if (!sim.simUniv) {
      throw new Error('Simulation universe not initialized properly');
    }

    console.log('🎯 Simulation ready - proceeding to platelet generation...');
  } catch (error) {
    console.error('❌ Simulation initialization failed:', error);
    throw error;
  }

  // Update storage info in UI
  const storageTypeElement = document.getElementById('storage-type');
  if (storageTypeElement) {
    storageTypeElement.textContent = 'IDBSun (Shared IndexedDB)';
    storageTypeElement.style.color = '#4CAF50'; // Green color to indicate success
  }

  // --- Add 20 Large Plates ---
  // Generate 20 large plates using the simulation's planet radius
  const largePlates = PlateSpectrumGenerator.generateLargePlates({
    planetRadius: sim.planetRadius, // sim.planetRadius is already in km
    count: 20,
    minRadius: Math.PI / 12, // Reduced size by 1/3
    maxRadius: Math.PI / 6, // Reduced size by 1/3
  });

  // Add large plates to the simulation
  for (const plate of largePlates) {
    await sim.addPlate(plate);
  }

  // Get all plates from the simulation (including the newly added large ones)
  const platesCollection = sim.simUniv.get('plates');
  const allPlates: SimPlateIF[] = [];

  console.log(`🔍 Getting plates from collection...`);

  // Manually iterate the async generator
  const plateGenerator = platesCollection.find('planetId', sim.planet.id);
  let plateResult = await plateGenerator.next();

  while (!plateResult.done) {
    const [id, plate] = plateResult.value;
    allPlates.push(plate);

    if (allPlates.length <= 5) {
      // Only log first 5 to avoid spam
      console.log(
        `   Found plate ${allPlates.length}: ${plate.id}, radius: ${plate.radius}`,
      );
      console.log('     Plate position:', plate.position);

      // Check if position is on Earth's surface
      const positionVector = new THREE.Vector3(
        plate.position.x,
        plate.position.y,
        plate.position.z,
      );
      const distanceFromCenter = positionVector.length();
      console.log(
        '     Distance from center:',
        distanceFromCenter.toFixed(1),
        'km',
      );
      console.log(
        '     Expected Earth surface:',
        EARTH_RADIUS.toFixed(1),
        'km',
      );
      console.log(
        '     Position ratio to Earth radius:',
        (distanceFromCenter / EARTH_RADIUS).toFixed(3),
      );
    }

    // Get next plate
    plateResult = await plateGenerator.next();
  }

  console.log(`Found ${allPlates.length} plates in the simulation.`);

  // CRITICAL: Verify plates are actually in the database
  console.log(`🔍 VERIFYING PLATES ARE IN DATABASE...`);
  const platesCollectionVerify = sim.simUniv.get('plates');
  const plateCount = await platesCollectionVerify.count();
  console.log(`📊 Database reports ${plateCount} plates stored`);

  if (plateCount === 0) {
    console.error(
      `🚨 CRITICAL: Database shows 0 plates but we found ${allPlates.length} in memory!`,
    );
    console.error(
      `🚨 This confirms plates are NOT being written to persistent storage!`,
    );
  } else {
    console.log(
      `✅ Database verification: ${plateCount} plates confirmed in storage`,
    );
  }

  // Create platelet manager with workers DISABLED for debugging
  console.log(
    `🔧 Creating PlateletManager with workers DISABLED for debugging...`,
  );
  const plateletManager = new PlateletManager(sim, false); // DISABLE workers for debugging

  // Update worker status in UI
  const workerStatus = plateletManager.getWorkerStatus();
  const workerStatusElement = document.getElementById('worker-status');
  if (workerStatusElement) {
    if (workerStatus.enabled && workerStatus.available) {
      workerStatusElement.textContent = 'Enabled (IDBSun Worker Engine)';
      workerStatusElement.style.color = '#4CAF50'; // Green color to indicate success
    } else if (workerStatus.enabled && !workerStatus.available) {
      workerStatusElement.textContent =
        'Enabled but unavailable (Fallback to main thread)';
      workerStatusElement.style.color = '#FFC107'; // Yellow/amber color to indicate warning
    } else {
      workerStatusElement.textContent = 'Disabled (Using main thread only)';
      workerStatusElement.style.color = '#9E9E9E'; // Gray color to indicate disabled
    }
  }

  // Generate platelets for all plates first
  console.log('Generating platelets for all plates...');
  console.time('⏱️ Platelet Generation');

  // Track start time for more precise measurement
  const startTime = performance.now();

  // Use the new parallel processing method for true parallelization
  const plateIds = allPlates.map((plate) => plate.id);
  console.log('🔍 Plate IDs for platelet generation:', plateIds);
  console.log(
    '🔍 First few plates:',
    allPlates.slice(0, 3).map((p) => ({ id: p.id, hasId: !!p.id })),
  );

  // Examine the actual plate objects to see what properties they have
  console.log('🔍 Detailed examination of first plate:');
  if (allPlates.length > 0) {
    const firstPlate = allPlates[0];
    console.log('  Full plate object:', firstPlate);
    console.log('  Plate keys:', Object.keys(firstPlate));
    console.log('  Plate.id:', firstPlate.id);
    console.log('  Plate.name:', firstPlate.name);
    console.log('  Plate.radius:', firstPlate.radius);
    console.log('  Has id property:', 'id' in firstPlate);
    console.log('  Type of id:', typeof firstPlate.id);
  }

  // Check for any undefined/null IDs
  const invalidIds = plateIds.filter((id) => !id);
  if (invalidIds.length > 0) {
    console.error('❌ Found plates with invalid IDs:', invalidIds);
    console.error(
      '❌ This suggests plates are being retrieved without proper IDs',
    );
    console.error('❌ Need to check plate storage/retrieval process');
    throw new Error(
      `Found ${invalidIds.length} plates with invalid IDs - check plate storage/retrieval`,
    );
  }

  const plateletsByPlate =
    await plateletManager.generatePlateletsForMultiplePlates(plateIds);

  // Convert Map to array format for compatibility
  const allPlatelets = Array.from(plateletsByPlate.values());

  // Calculate total platelets and time
  const endTime = performance.now();
  const generationTime = endTime - startTime;
  const totalPlatelets = allPlatelets.reduce(
    (sum, platelets) => sum + platelets.length,
    0,
  );

  console.timeEnd('⏱️ Platelet Generation');
  console.log(
    `⏱️ Platelet Generation (Workers): ${generationTime.toFixed(2)} ms`,
  );
  console.log(`🎯 Total platelets generated: ${totalPlatelets}`);

  // Update performance metrics in UI
  const generationTimeElement = document.getElementById('generation-time');
  const plateletCountElement = document.getElementById('platelet-count');

  if (generationTimeElement) {
    generationTimeElement.textContent = `${generationTime.toFixed(2)} ms`;
    // Color based on performance (green for fast, yellow for medium, red for slow)
    if (generationTime < 5000) {
      generationTimeElement.style.color = '#4CAF50'; // Green for fast
    } else if (generationTime < 15000) {
      generationTimeElement.style.color = '#FFC107'; // Yellow for medium
    } else {
      generationTimeElement.style.color = '#F44336'; // Red for slow
    }
  }

  if (plateletCountElement) {
    plateletCountElement.textContent = totalPlatelets.toString();
  }

  // Populate neighbor relationships between platelets
  console.log('Populating platelet neighbor relationships...');
  console.time('⏱️ Neighbor Population');
  await sim.populatePlateletNeighbors();
  console.timeEnd('⏱️ Neighbor Population');

  // Skip the complex edge deletion for now - just focus on getting platelets visible
  console.log(
    'Skipping edge deletion for now - focusing on basic visualization...',
  );

  // Create a PlateVisualizer for each plate AFTER deleting platelets
  console.time('⏱️ Visualization Creation');
  const plateVisualizers: PlateletVisualizer[] = []; // Use PlateletVisualizer type

  for (const plate of allPlates) {
    // Pass scene, planetRadius, plate, and plateletManager to the constructor
    const visualizer = new PlateletVisualizer(
      scene,
      EARTH_RADIUS,
      plate,
      plateletManager,
    );

    // Initialize platelets asynchronously
    await visualizer.initializeAsync();

    // Add to scene
    visualizer.visualize();
    plateVisualizers.push(visualizer);
  }
  console.timeEnd('⏱️ Visualization Creation');

  console.log(`Created visualizers for ${plateVisualizers.length} plates.`);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(EARTH_RADIUS * 0.5); // Make axes helper relative to Earth radius
  scene.add(axesHelper);

  console.log('📷 Camera position:', camera.position);
  console.log('📷 Camera is looking at:', controls.target);
  console.log('🌍 Earth radius:', EARTH_RADIUS);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Update controls
    controls.update();

    // Update light helper (optional)
    // lightHelper.update(); // Keep this commented out unless needed

    // Update each plate visualizer
    plateVisualizers.forEach((visualizer) => {
      visualizer.update();
    });

    // Render scene
    renderer.render(scene, camera);
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start animation
  animate();
}

// Call the async function with detailed error handling
generateAndVisualizePlatelets().catch((error) => {
  console.error('❌ Fatal error in generateAndVisualizePlatelets:', error);
  console.error('Stack trace:', error.stack);

  // Update storage info to show error
  const storageTypeElement = document.getElementById('storage-type');
  if (storageTypeElement) {
    storageTypeElement.textContent = 'Error: Failed to initialize IDBSun';
    storageTypeElement.style.color = '#F44336'; // Red color to indicate error
  }

  // Show error on screen
  document.body.innerHTML = `
    <div style="color: red; font-family: monospace; padding: 20px; background: black;">
      <h1>Visualization Error</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <p><strong>Storage:</strong> Failed to initialize IDBSun</p>
      <pre>${error.stack}</pre>
    </div>
  `;
});
