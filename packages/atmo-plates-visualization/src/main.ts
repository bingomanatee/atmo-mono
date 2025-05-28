import './style.css';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  PlateletManager,
  PlateSimulation,
  type SimPlateIF,
} from '@wonderlandlabs/atmo-plates';
import { PlateVisualizer } from './PlateVisualizer'; // Import the new class from correct relative path

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

// Get all plates from the simulation
const platesCollection = sim.simUniv.get('plates');
const allPlates: SimPlateIF[] = [];
platesCollection.each((plate: SimPlateIF) => {
  allPlates.push(plate);
});

// Create platelet manager
const plateletManager = new PlateletManager(sim);

// Create a PlateVisualizer for each plate
const plateVisualizers: PlateVisualizer[] = [];
allPlates.forEach((plate, index) => {
  const visualizer = new PlateVisualizer(plate, plateletManager);
  visualizer.addToScene(scene);
  plateVisualizers.push(visualizer);
});

console.log(`Created visualizers for ${plateVisualizers.length} plates.`);

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
