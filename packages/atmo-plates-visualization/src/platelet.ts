import './style.css';
import {
  PlateletManager,
  PlateSpectrumGenerator,
  type SimPlateIF,
} from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import * as THREE from 'three';
import { createPlateSimulation } from './utils/simulationUtils';

import { PlateletVisualizer } from './PlateletVisualizer';
import { createThreeScene } from './threeSetup';

// Setup Three.js scene, camera, renderer, controls, planet, etc.
console.log('🎬 Setting up Three.js scene...');
const { scene, camera, renderer, controls } = createThreeScene();
console.log('✅ Three.js scene setup complete');

// --- Simulation Setup ---
const NUM_PLATES = 20;

// Database cleanup is now handled centrally in the simulation initialization

async function generateAndVisualizePlatelets() {
  // Create simulation using visualization utilities with proper database clearing
  console.log('🔧 Creating simulation with database clearing...');
  const sim = await createPlateSimulation({
    plateCount: NUM_PLATES,
    clearDatabases: true, // This uses the visualization layer's database utilities
  });
  console.log('✅ Simulation created and initialized successfully');

  if (!sim.simUniv) {
    throw new Error('Simulation universe not initialized properly');
  }

  console.log('🎯 Simulation ready - proceeding to platelet generation...');

  // Update storage info in UI
  const storageTypeElement = document.getElementById('storage-type');
  if (storageTypeElement) {
    storageTypeElement.textContent = 'IDBSun (Shared IndexedDB)';
    storageTypeElement.style.color = '#4CAF50'; // Green color to indicate success
  }

  // --- Add 20 Large Plates ---
  // Generate 20 large plates using Earth radius
  const planet = await sim.planet();
  const largePlates = PlateSpectrumGenerator.generateLargePlates({
    planetRadius: planet.radius, // Get radius from planet object
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
  const plateGenerator = platesCollection.find(
    'planetId',
    sim.simulation.planetId,
  );
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

  // Create PlateletManager with injectable architecture
  const plateletManager = new PlateletManager(sim.universe);

  // Update worker status in UI - workers will be handled in visualization layer
  const workerStatusElement = document.getElementById('worker-status');
  if (workerStatusElement) {
    workerStatusElement.textContent = 'Core Module (No Workers)';
    workerStatusElement.style.color = '#2196F3'; // Blue color to indicate core module
  }

  // Generate platelets for all plates first
  console.log('Generating platelets for all plates...');
  console.time('⏱️ Platelet Generation');

  // Generate platelets for each plate using core injectable architecture
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

  let total = 0;
  // Generate platelets for each plate individually (core architecture)
  for (const plateId of plateIds) {
    const count = await plateletManager.generatePlatelets(plateId);
    total += count;
  }

  const plateletCountElement = document.getElementById('platelet-count');

  if (plateletCountElement) {
    plateletCountElement.textContent = total.toString();
  }

  await sim.populatePlateletNeighbors();
  console.timeEnd('⏱️ Neighbor Population');

  await sim.createIrregularPlateEdges();

  // Create visualizers BEFORE edge detection so they see the full platelet set
  console.time('⏱️ Visualization Creation');
  const plateVisualizers: PlateletVisualizer[] = [];

  for (const plate of allPlates) {
    // Pass scene, planetRadius, plate, and plateletManager to the constructor
    const visualizer = new PlateletVisualizer(
      scene,
      EARTH_RADIUS,
      plate,
      plateletManager,
    );

    // Create initial mesh with current platelets (before deletion)
    await visualizer.createInitialVisualization();

    // Add to scene
    visualizer.visualize();
    plateVisualizers.push(visualizer);
  }
  console.timeEnd('⏱️ Visualization Creation');

  console.log(`Created visualizers for ${plateVisualizers.length} plates.`);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(EARTH_RADIUS * 0.5); // Make axes helper relative to Earth radius
  scene.add(axesHelper);

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
