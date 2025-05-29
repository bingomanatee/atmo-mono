import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlateSimulation, type SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { ForceVisualizer } from './ForceVisualizer';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import { PlateSpectrumGenerator } from '@wonderlandlabs/atmo-plates';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  1,
  EARTH_RADIUS * 5,
);
camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS * 1.5, EARTH_RADIUS * 2);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(EARTH_RADIUS, EARTH_RADIUS, EARTH_RADIUS);
scene.add(directionalLight);

// Add planet sphere (Earth representation)
const planetGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32);
const planetMaterial = new THREE.MeshPhongMaterial({
  color: 0x2233ff,
  transparent: true,
  opacity: 0.3,
  wireframe: true,
});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
scene.add(planet);

// Initialize PlateSimulation
const simulation = new PlateSimulation({
  planetRadius: EARTH_RADIUS,
  plateCount: 5, // Start with a few plates for the demo
});
simulation.init();

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
  simulation.addPlate(plate);
});

// Initialize a map to hold ForceVisualizer instances for each plate
const plateVisualizers: Map<string, ForceVisualizer> = new Map();

// Get initial plates from the simulation and create visualizers (including large ones)
const initialPlates: SimPlateIF[] = Array.from(
  simulation.simUniv.get('plates').values(),
);

initialPlates.forEach((plate) => {
  const visualizer = new ForceVisualizer(scene, EARTH_RADIUS, plate);
  visualizer.visualize(); // Initialize the plate's visualization (cylinder)
  plateVisualizers.set(plate.id, visualizer);
});

// Animation loop (only for controls and rendering)
function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add a button to trigger simulation steps
const stepButton = document.createElement('button');
stepButton.textContent = 'Next Step';
document.body.appendChild(stepButton);

// Event listener for the button
stepButton.addEventListener('click', () => {
  // Run one simulation step and get the forces
  const forces = simulation.applyForceLayout();

  // Get the updated plates
  const updatedPlates: SimPlateIF[] = Array.from(
    simulation.simUniv.get('plates').values(),
  );

  // Update each plate visualizer with the new plate data and forces
  updatedPlates.forEach((updatedPlate) => {
    const visualizer = plateVisualizers.get(updatedPlate.id);
    if (visualizer) {
      // We need to pass the entire updatedPlates array and the forces map
      visualizer.update(updatedPlates, forces);
    } else {
      console.warn(`Visualizer not found for plate ${updatedPlate.id}`);
      // Optionally, create a new visualizer if a plate was added during simulation
    }
  });
});
