import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TreeNode } from '../TreeNode';

// Add visual elements to TreeNode
function addVisuals(node: TreeNode) {
  // Create a flat cylinder to represent the node
  const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
  const cylinderMaterial = new THREE.MeshPhongMaterial({ color: 0x44aaff });
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  node.add(cylinder);

  // Create a cone to represent the up vector
  const coneGeometry = new THREE.ConeGeometry(0.2, 1, 16);
  const coneMaterial = new THREE.MeshPhongMaterial({ color: 0xff00ff });
  const upCone = new THREE.Mesh(coneGeometry, coneMaterial);
  upCone.position.copy(node.up);
  upCone.lookAt(new THREE.Vector3(0, 0, 0));
  upCone.rotateX(Math.PI / 2);
  node.add(upCone);

  // Store references to the visual elements
  (node as any).visuals = {
    cylinder,
    upCone,
  };

  return node;
}

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

// Create tree nodes
const rootNode = new TreeNode({
  id: 'root',
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(rootNode);
scene.add(rootNode);

// First level children
const child1 = new TreeNode({
  id: 'child1',
  position: { x: 5, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(child1);
rootNode.add(child1);

const child2 = new TreeNode({
  id: 'child2',
  position: { x: -3, y: 0, z: 4 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(child2);
rootNode.add(child2);

const child3 = new TreeNode({
  id: 'child3',
  position: { x: 0, y: 0, z: -6 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(child3);
rootNode.add(child3);

// Second level children (grandchildren)
const grandchild1 = new TreeNode({
  id: 'grandchild1',
  position: { x: 2, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(grandchild1);
child1.add(grandchild1);

const grandchild2 = new TreeNode({
  id: 'grandchild2',
  position: { x: 0, y: 0, z: 2 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(grandchild2);
child1.add(grandchild2);

const grandchild3 = new TreeNode({
  id: 'grandchild3',
  position: { x: 0, y: 2, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(grandchild3);
child2.add(grandchild3);

const grandchild4 = new TreeNode({
  id: 'grandchild4',
  position: { x: 2, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});
addVisuals(grandchild4);
child3.add(grandchild4);

// Animation variables
const orbitRadius = 3;
const orbitSpeed = 0.01;
let time = 0;

// Reposition function to update node positions
function reposition() {
  time += orbitSpeed;

  // Rotate first level children around root
  const pos1 = new THREE.Vector3(
    Math.cos(time) * orbitRadius,
    0,
    Math.sin(time) * orbitRadius,
  );
  child1.updatePosition(pos1);

  const pos2 = new THREE.Vector3(
    Math.cos(time + (Math.PI * 2) / 3) * orbitRadius,
    0,
    Math.sin(time + (Math.PI * 2) / 3) * orbitRadius,
  );
  child2.updatePosition(pos2);

  const pos3 = new THREE.Vector3(
    Math.cos(time + (Math.PI * 4) / 3) * orbitRadius,
    0,
    Math.sin(time + (Math.PI * 4) / 3) * orbitRadius,
  );
  child3.updatePosition(pos3);

  // Rotate second level children around their parents
  const smallRadius = 1.5;

  const gpos1 = new THREE.Vector3(
    Math.cos(time * 1.5) * smallRadius,
    0,
    Math.sin(time * 1.5) * smallRadius,
  );
  grandchild1.updatePosition(gpos1);

  const gpos2 = new THREE.Vector3(
    Math.cos(time * 1.5 + Math.PI) * smallRadius,
    0,
    Math.sin(time * 1.5 + Math.PI) * smallRadius,
  );
  grandchild2.updatePosition(gpos2);

  const gpos3 = new THREE.Vector3(
    Math.cos(time * 2) * smallRadius,
    0,
    Math.sin(time * 2) * smallRadius,
  );
  grandchild3.updatePosition(gpos3);

  const gpos4 = new THREE.Vector3(
    Math.cos(time * 2.5) * smallRadius,
    0,
    Math.sin(time * 2.5) * smallRadius,
  );
  grandchild4.updatePosition(gpos4);

  // Update visual elements for all nodes
  updateVisuals(rootNode);
  updateVisuals(child1);
  updateVisuals(child2);
  updateVisuals(child3);
  updateVisuals(grandchild1);
  updateVisuals(grandchild2);
  updateVisuals(grandchild3);
  updateVisuals(grandchild4);
}

// Update visual elements to match node orientation
function updateVisuals(node: TreeNode) {
  if ((node as any).visuals) {
    // Update up cone to match the current up vector
    (node as any).visuals.upCone.position.copy(node.up);
    (node as any).visuals.upCone.lookAt(new THREE.Vector3(0, 0, 0));
    (node as any).visuals.upCone.rotateX(Math.PI / 2);
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update controls
  controls.update();

  // Reposition nodes
  reposition();

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
