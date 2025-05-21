import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeOrbitalFrame } from '../dist';

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

// Grid helper
const gridHelper = new THREE.GridHelper(20, 20);
scene.add(gridHelper);

// Constants for all frames
const STANDARD_RADIUS = 3;

// Create orbital frames with different configurations
for (let i = 0; i < 20; i++) {
  const randomAxis = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
  ).normalize();

  const randomOrbit = new ThreeOrbitalFrame({
    name: `orbit${i}`,
    radius: STANDARD_RADIUS,
    velocity: 0.01 + Math.random() * 0.04, // Ensure non-zero velocity
    axis: randomAxis,
  });
  // Add directly to scene
  scene.add(randomOrbit);
}

// Call visualize once for all frames
scene.traverse((object) => {
  if (object instanceof ThreeOrbitalFrame) {
    object.visualize();
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update controls
  controls.update();

  // Update all orbital frames in the scene
  scene.traverse((object) => {
    if (object instanceof ThreeOrbitalFrame) {
      object.orbit();
    }
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
