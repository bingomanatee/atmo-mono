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

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
// OVERFLOW is now handled within PlateVisualizer export const OVERFLOW = 1.05;

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  1, // Adjusted near clipping plane
  EARTH_RADIUS * 3, // Increased far clipping plane
);
camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS * 1.5, EARTH_RADIUS * 2); // Adjusted camera position

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

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
  wireframeLinewidth: 3, // Increased wireframe thickness
});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.set(0, 0, 0); // Set position to origin
scene.add(planet);

// --- Simulation Setup ---
const NUM_PLATES = 60;
// Initialize simulation with 60 plates
const sim = new PlateSimulation({
  planetRadius: EARTH_RADIUS,
  plateCount: NUM_PLATES,
});
sim.init();

// --- Add 20 Large Plates ---
// Generate 20 large plates using the simulation's planet radius
const largePlates = PlateSpectrumGenerator.generateLargePlates({
  planetRadius: sim.planetRadius / 1000, // Get from simulation and convert meters to kilometers
  count: 20,
  minRadius: Math.PI / 12, // Reduced size by 1/3
  maxRadius: Math.PI / 6, // Reduced size by 1/3
});

// Add large plates to the simulation
largePlates.forEach((plate) => {
  sim.addPlate(plate);
});

// Get all plates from the simulation (including the newly added large ones)
const platesCollection = sim.simUniv.get('plates');
const allPlates: SimPlateIF[] = [];
platesCollection.each((plate: SimPlateIF) => {
  allPlates.push(plate);
});

// Wrap the async operations in an async function
async function generateAndVisualizePlatelets() {
  // Create platelet manager
  const plateletManager = new PlateletManager(sim);

  // Generate platelets for all plates first
  console.log('Generating platelets for all plates...');
  console.time('⏱️ Platelet Generation');

  let totalPlateletsGenerated = 0;
  allPlates.forEach((plate, index) => {
    console.log(
      `🔍 Generating platelets for plate ${index + 1}/${allPlates.length}: ${plate.id}`,
    );
    console.log(`   Plate radius: ${plate.radius}, position:`, plate.position);

    const platelets = plateletManager.generatePlatelets(plate.id);
    console.log(
      `   Generated ${platelets.length} platelets for plate ${plate.id}`,
    );
    totalPlateletsGenerated += platelets.length;
  });

  console.log(
    `🎯 Total platelets generated across all plates: ${totalPlateletsGenerated}`,
  );
  console.timeEnd('⏱️ Platelet Generation');

  // Populate neighbor relationships between platelets
  console.log('Populating platelet neighbor relationships...');
  console.time('⏱️ Neighbor Population');
  await sim.populatePlateletNeighbors();
  console.timeEnd('⏱️ Neighbor Population');

  // Create a PlateVisualizer for each plate
  const plateVisualizers: PlateletVisualizer[] = []; // Use PlateletVisualizer type

  console.log('Creating and initializing visualizers...');
  console.time('⏱️ Visualizer Creation');

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

  console.timeEnd('⏱️ Visualizer Creation');
  console.log(`Created visualizers for ${plateVisualizers.length} plates.`);
}

// Call the async function
generateAndVisualizePlatelets().catch(console.error);

// Get the platelets collection from the simulation (optional, for direct access if needed)
const plateletsCollection = sim.simUniv.get('platelets');
if (!plateletsCollection) console.warn('platelets collection not found');

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
