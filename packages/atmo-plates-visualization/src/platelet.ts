import './style.css';
import * as THREE from 'three';

// Earth radius in kilometers (not meters like the atmo-utils constant)
const EARTH_RADIUS = 6371; // km
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  PlateletManager,
  PlateSimulation,
  type SimPlateIF,
  PlateSpectrumGenerator,
} from '@wonderlandlabs/atmo-plates';
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
// Generate 20 large plates
const largePlates = PlateSpectrumGenerator.generateLargePlates({
  planetRadius: EARTH_RADIUS,
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
sim.populatePlateletNeighbors();
console.timeEnd('⏱️ Neighbor Population');

// Refresh neighbor relationships to clean up any invalid references
console.log('Initial neighbor cleanup...');
console.time('⏱️ Initial Neighbor Cleanup');
sim.refreshNeighbors();
console.timeEnd('⏱️ Initial Neighbor Cleanup');

// Create irregular edges by deleting edge platelets BEFORE visualization
console.log('Creating irregular plate edges...');
console.time('⏱️ Edge Creation Total');

console.time('⏱️ Pre-deletion Analysis');
const plateletsColl = sim.simUniv.get('platelets');
const initialPlateletCount = plateletsColl?.count() || 0;
console.log(`Initial platelet count: ${initialPlateletCount}`);

// Add debugging to see what's happening
console.log('Checking platelets before deletion...');
let plateletsByPlate = new Map();
plateletsColl?.each((platelet: any) => {
  const plateId = platelet.plateId;
  if (!plateletsByPlate.has(plateId)) {
    plateletsByPlate.set(plateId, []);
  }
  plateletsByPlate.get(plateId).push(platelet);
});

plateletsByPlate.forEach((platelets, plateId) => {
  console.log(`Plate ${plateId}: ${platelets.length} platelets`);
  // Check neighbor counts
  const neighborCounts = platelets.map((p) => p.neighbors?.length || 0);
  const minNeighbors = Math.min(...neighborCounts);
  const maxNeighbors = Math.max(...neighborCounts);
  const avgNeighbors =
    neighborCounts.reduce((a, b) => a + b, 0) / neighborCounts.length;
  console.log(
    `  Neighbors - Min: ${minNeighbors}, Max: ${maxNeighbors}, Avg: ${avgNeighbors.toFixed(1)}`,
  );
});
console.timeEnd('⏱️ Pre-deletion Analysis');

console.time('⏱️ Actual Edge Deletion');
sim.createIrregularPlateEdges();
console.timeEnd('⏱️ Actual Edge Deletion');

const finalPlateletCount = plateletsColl?.count() || 0;
const deletedCount = initialPlateletCount - finalPlateletCount;
console.log(`Final platelet count: ${finalPlateletCount}`);
console.log(`Deleted ${deletedCount} platelets to create irregular edges`);
console.timeEnd('⏱️ Edge Creation Total');

// Create a PlateVisualizer for each plate AFTER deleting platelets
console.time('⏱️ Visualization Creation');
const plateVisualizers: PlateletVisualizer[] = []; // Use PlateletVisualizer type
allPlates.forEach((plate, index) => {
  // Pass scene, planetRadius, plate, and plateletManager to the constructor
  const visualizer = new PlateletVisualizer(
    scene,
    EARTH_RADIUS,
    plate,
    plateletManager,
  );
  visualizer.visualize(); // Call the visualize method to add to scene
  plateVisualizers.push(visualizer);
});
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
