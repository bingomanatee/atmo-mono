import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlateletManager } from '../src/PlateSimulation/PlateletManager';
import { PlateSimulation } from '../src/PlateSimulation/PlateSimulation';
import { Vector3 } from 'three';
import type { SimPlateIF } from '../src/PlateSimulation/types.PlateSimulation';

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
  planetId: 'earth',
  velocity: new Vector3(0, 0, 0),
  isActive: true,
};

// Create platelet manager and generate platelets
const manager = new PlateletManager();
const platelets = manager.generatePlatelets(testPlate);

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
platelets.forEach((platelet) => {
  // Create a disc geometry
  const geometry = new THREE.CircleGeometry(platelet.radius, 32);

  // Create material with plate color
  const material = new THREE.MeshPhongMaterial({
    color: getPlateColor(platelet.plateId),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);

  // Position the mesh
  mesh.position.copy(platelet.position);

  // Scale height based on density
  const heightScale = platelet.density / 2700; // Normalize to average density
  mesh.scale.z = heightScale;

  // Make the disc face outward from the center
  mesh.lookAt(new Vector3(0, 0, 0));

  // Add to scene
  scene.add(mesh);
});

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
