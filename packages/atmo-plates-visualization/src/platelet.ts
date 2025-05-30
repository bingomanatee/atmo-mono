import './style.css';
import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  PlateletManager,
  PlateSimulation,
  type SimPlateIF,
  PlateSpectrumGenerator,
} from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils'; // Use the correct Earth radius in meters
import { PlateletVisualizer } from './PlateletVisualizer'; // Corrected import path

console.log('🚀 Platelet visualization script starting...');
console.log('📏 EARTH_RADIUS:', EARTH_RADIUS);
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
// Wrap everything in an async function since we need to await sim.init()
async function generateAndVisualizePlatelets() {
  // Initialize simulation with 60 plates
  const sim = new PlateSimulation({
    planetRadius: EARTH_RADIUS,
    plateCount: NUM_PLATES,
  });
  await sim.init();

  // --- Add 20 Large Plates ---
  // Generate 20 large plates
  const largePlates = PlateSpectrumGenerator.generateLargePlates({
    planetRadius: EARTH_RADIUS,
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

  // Use proper async iteration with the find method to get all plates
  for await (const [id, plate] of platesCollection.find()) {
    allPlates.push(plate);
    if (allPlates.length <= 5) {
      // Only log first 5 to avoid spam
      console.log(
        `   Found plate ${allPlates.length}: ${plate.id}, radius: ${plate.radius}`,
      );
    }
  }

  console.log(`Found ${allPlates.length} plates in the simulation.`);
  // Create platelet manager
  const plateletManager = new PlateletManager(sim);

  // Generate platelets for all plates first
  console.log('Generating platelets for all plates...');
  console.time('⏱️ Platelet Generation');
  allPlates.forEach((plate) => {
    plateletManager.generatePlatelets(plate.id);
  });
  console.timeEnd('⏱️ Platelet Generation');

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

  // Add a large test sphere to make sure we can see SOMETHING
  const testSphereGeometry = new THREE.SphereGeometry(2000, 16, 12); // 2000km radius - very large!
  const testSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Bright green
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });
  const testSphere = new THREE.Mesh(testSphereGeometry, testSphereMaterial);
  testSphere.position.set(EARTH_RADIUS * 1.5, 0, 0); // Position it to the side of Earth
  scene.add(testSphere);
  console.log(
    '🟢 Added large green test sphere at position:',
    testSphere.position,
  );
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

  // Show error on screen
  document.body.innerHTML = `
    <div style="color: red; font-family: monospace; padding: 20px; background: black;">
      <h1>Visualization Error</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <pre>${error.stack}</pre>
    </div>
  `;
});
