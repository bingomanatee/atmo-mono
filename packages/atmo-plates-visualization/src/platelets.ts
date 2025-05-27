import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  PlateletManager,
  PlateSimulation,
  type SimPlateIF,
} from '@wonderlandlabs/atmo-plates';
import { Vector3 } from 'three';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
export const OVERFLOW = 1.05;
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

// Add a helper to visualize the lights
const lightHelper = new THREE.DirectionalLightHelper(
  directionalLight,
  EARTH_RADIUS / 2,
); // Adjusted helper size
scene.add(lightHelper);

// Initialize simulation and add test plate
const sim = new PlateSimulation({});
sim.init();

// Create Earth planet first
const earthPlanet = sim.makePlanet(EARTH_RADIUS, 'Earth');

// Create a test plate
const testPlate: SimPlateIF = {
  id: 'test_plate',
  name: 'Test Plate',
  radius: 5000000 * 1.2, // 6000 km (increased by 20%)
  density: 2800,
  thickness: 300, // 300 km
  position: new Vector3(0, EARTH_RADIUS, 0), // North pole
  planetId: earthPlanet.id,
  velocity: new Vector3(0, 0, 0),
  isActive: true,
};

const plateId = sim.addPlate(testPlate);

// Add planet sphere
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

// Create orbital frame for the plate
const orbitalFrame = new ThreeOrbitalFrame({
  axis: new Vector3(0, 1, 0), // Rotate around Y axis
  velocity: 1000, // Much faster rotation
  radius: EARTH_RADIUS,
});

// Add orbital frame to scene
scene.add(orbitalFrame);

// Add a cone to the orbital frame at (0, 0, EARTH_RADIUS) for visual validation
const coneGeometry = new THREE.ConeGeometry(
  EARTH_RADIUS * 0.05,
  EARTH_RADIUS * 0.2,
  32,
); // Adjust size as needed

const coneMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 }); // Yellow color
const cone = new THREE.Mesh(coneGeometry, coneMaterial);
cone.position.set(
  orbitalFrame.worldToLocal(new Vector3().copy(testPlate.position)),
);
orbitalFrame.add(cone);

// Create platelet manager and generate platelets
const manager = new PlateletManager(sim);
const platelets = manager.generatePlatelets(plateId);

// Get the platelets collection from the simulation
const plateletsCollection = sim.simUniv.get('platelets');
if (!plateletsCollection) throw new Error('platelets collection not found');

// Create a single geometry for all platelets - use a base radius of 1 since we'll scale it per instance
const geometry = new THREE.CylinderGeometry(1, 1, 1, 18); // radius, radius, height (1km), segments

// Create a single material for all platelets
const material = new THREE.MeshPhongMaterial({
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.8,
  shininess: 30,
});

// Create instanced mesh
const instancedMesh = new THREE.InstancedMesh(
  geometry,
  material,
  platelets.length,
);

// Create matrices for each instance
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const worldMatrix = new THREE.Matrix4();
const localMatrix = new THREE.Matrix4();

// Set up each instance
platelets.forEach((platelet, index) => {
  // Set position
  position.copy(platelet.position);

  // Set scale (x,z scale by the platelet's radius, y scales by thickness in km)
  scale.set(
    platelet.radius * OVERFLOW,
    platelet.thickness,
    platelet.radius * OVERFLOW,
  );

  // First rotate to face outward from center
  const direction = platelet.position.clone().normalize();
  const outwardRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction,
  );

  // Then rotate 90 degrees around x-axis to make cylinder stand upright
  const uprightRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2,
  );

  // Combine rotations
  quaternion.multiplyQuaternions(outwardRotation, uprightRotation);

  // Create world matrix
  worldMatrix.compose(position, quaternion, scale);

  // Convert world matrix to local matrix relative to orbital frame
  localMatrix.copy(worldMatrix);
  localMatrix.premultiply(orbitalFrame.matrixWorld.invert());

  // Set instance matrix
  instancedMesh.setMatrixAt(index, localMatrix);

  // Generate a random color for each platelet instance
  const hue = Math.random();
  const saturation = 0.7 + Math.random() * 0.3; // 0.7-1.0
  const lightness = 0.5 + Math.random() * 0.2; // 0.5-0.7
  const instanceColor = new THREE.Color().setHSL(hue, saturation, lightness);

  // Set instance color
  instancedMesh.setColorAt(index, instanceColor);
});

// Add instanced mesh to orbital frame instead of scene
orbitalFrame.add(instancedMesh);

// Add axes helper
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update controls
  controls.update();

  // Update light helper
  lightHelper.update();

  // Orbit the frame
  orbitalFrame.orbit();

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
