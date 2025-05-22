import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlateletManager } from '../src/PlateSimulation/PlateletManager';
import { PlateSimulation } from '../src/PlateSimulation/PlateSimulation';
import { Vector3 } from 'three';
import type { SimPlateIF } from '../src/PlateSimulation/types.PlateSimulation';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

// Camera setup
const EARTH_RADIUS = 6371000; // meters
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  1, // Adjusted near clipping plane
  EARTH_RADIUS * 5, // Adjusted far clipping plane (more than twice the Earth's radius)
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
  EARTH_RADIUS * 5,
  EARTH_RADIUS * 5,
  EARTH_RADIUS * 5,
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

// Create a test plate
const testPlate: SimPlateIF = {
  id: 'test_plate',
  name: 'Test Plate',
  radius: 5000000, // 5000 km
  density: 2800,
  thickness: 100000, // 100 km
  position: new Vector3(0, EARTH_RADIUS, 0), // North pole
  planetId: 'earth',
  velocity: new Vector3(0, 0, 0),
  isActive: true,
};

// Add planet sphere
const planetGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32); // Use full Earth radius
const planetMaterial = new THREE.MeshPhongMaterial({
  color: 0x2233ff,
  transparent: true,
  opacity: 0.3,
  wireframe: true,
});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.set(0, 0, 0); // Set position to origin
scene.add(planet);

// Create platelet manager and generate platelets
const manager = new PlateletManager();
const platelets = manager.generatePlatelets(testPlate);

console.log('Generated platelets count:', platelets.length);

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

// Create platelet meshes
const plateletGeometries: THREE.CircleGeometry[] = [];

platelets.forEach((platelet, index) => {
  console.log(`Platelet ${index} original position:`, platelet.position);
  // Create a disc geometry
  const geometry = new THREE.CircleGeometry(platelet.radius, 32);

  // Create a temporary mesh to handle positioning and orientation
  const tempMaterial = new THREE.MeshBasicMaterial();
  const tempMesh = new THREE.Mesh(geometry, tempMaterial);

  // 1. Translate the geometry outward by its radius in its local space (along initial local Z-axis)
  tempMesh.translateZ(platelet.radius);

  // 2. Orient the disc to lie flat on the surface, facing outward
  const outwardDirection = platelet.position.clone().normalize();
  const upVector = new THREE.Vector3(0, 0, 1); // The local Z-axis of the CircleGeometry initially points up (0,0,1)
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(upVector, outwardDirection);
  tempMesh.setRotationFromQuaternion(quaternion);

  // 3. Set the world position of the temporary mesh
  tempMesh.position.copy(platelet.position);

  // Calculate the world matrix for the temporary mesh
  tempMesh.updateMatrixWorld(true);

  // Apply the temporary mesh's world matrix to the original geometry
  geometry.applyMatrix4(tempMesh.matrixWorld);

  // Dispose of the temporary mesh and material
  tempMaterial.dispose();

  plateletGeometries.push(geometry);

  if (index === 0) {
    console.log(
      'First platelet position after temp mesh transform:',
      tempMesh.position,
    );
    console.log('First platelet geometry after matrix application:', geometry);
  }
});

// Merge all geometries into one
const mergedGeometry = BufferGeometryUtils.mergeGeometries(plateletGeometries);

// Create a single material (using the color of the first platelet for simplicity, or a more complex approach for multiple colors)
const mergedMaterial = new THREE.MeshPhongMaterial({
  color: getPlateColor(platelets[0]?.plateId || 'default'), // Use color of the first platelet or a default
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.8,
  shininess: 30,
});

// Create a single mesh
const mergedMesh = new THREE.Mesh(mergedGeometry, mergedMaterial);

// Add the single merged mesh to the scene
scene.add(mergedMesh);

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
