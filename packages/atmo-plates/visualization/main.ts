import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlateletManager } from '../src/PlateSimulation/managers/PlateletManager';
import { PlateSimulation } from '../src/PlateSimulation/PlateSimulation';
import { Vector3 } from 'three';
import type { SimPlateIF } from '../src/PlateSimulation/types.PlateSimulation';
import { h3HexRadiusAtResolution } from '@wonderlandlabs/atmo-utils';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(15, 10, 15);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Create a test plate
const EARTH_RADIUS = 6371000; // meters
const testPlate: SimPlateIF = {
  id: 'test_plate',
  name: 'Test Plate',
  radius: 5000000, // 5000 km
  density: 2800,
  thickness: 100000, // 100 km
  position: new Vector3(0, EARTH_RADIUS, 0), // North pole
  planetId: earthPlanet.id,
  velocity: new Vector3(0, 0, 0),
  isActive: true,
};

// Initialize simulation and add test plate
const sim = new PlateSimulation({});
sim.init();

// Create Earth planet first
const earthPlanet = sim.makePlanet(EARTH_RADIUS, 'Earth');

const plateId = sim.addPlate(testPlate);

// Create platelet manager and generate platelets
const manager = new PlateletManager(sim);
const platelets = manager.generatePlatelets(plateId);

// Create a color map for plates
const plateColors = new Map<string, THREE.Color>();
function getPlateColor(plateId: string): THREE.Color {
  if (!plateColors.has(plateId)) {
    // Generate a random color with good saturation and brightness
    const hue = Math.random();
    const saturation = 0.7 + Math.random() * 0.3; // 0.7-1.0
    const lightness = 0.5 + Math.random() * 0.2; // 0.5-0.7
    plateColors.set(
      plateId,
      new THREE.Color().setHSL(hue, saturation, lightness),
    );
  }
  return plateColors.get(plateId)!;
}

// Get the platelets collection from the simulation
const plateletsCollection = sim.simUniv.get('platelets');
if (!plateletsCollection) throw new Error('platelets collection not found');

// Create a single geometry for all platelets - use a base radius of 1 since we'll scale it per instance
const geometry = new THREE.CylinderGeometry(1, 1, 1, 6); // radius, radius, height (1km), segments

// Create a single material for all platelets
const material = new THREE.MeshPhongMaterial({
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.8,
});

// Create instanced mesh
const instancedMesh = new THREE.InstancedMesh(
  geometry,
  material,
  platelets.length,
);

// Create matrices for each instance
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

// Set up each instance
platelets.forEach((platelet, index) => {
  // Set position
  position.copy(platelet.position);

  // Set scale (x,z scale by the platelet's radius, y scales by thickness in km)
  scale.set(platelet.radius, platelet.thickness, platelet.radius);

  // Set rotation to face outward from center
  const direction = platelet.position.clone().normalize();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

  // Combine into matrix
  matrix.compose(position, quaternion, scale);

  // Set instance matrix
  instancedMesh.setMatrixAt(index, matrix);

  // Set instance color
  instancedMesh.setColorAt(index, getPlateColor(platelet.plateId));
});

// Add to scene
scene.add(instancedMesh);

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update controls
  controls.update();

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
