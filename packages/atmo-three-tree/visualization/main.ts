import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeNode } from '../dist';

const coneMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(1, 0.2, 0.9).getHex(),
});
const diskMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.2, 0.5, 1).getHex(),
});
const diskMaterialMajor = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.8, 0.9, 1).getHex(),
});
const centerMaterial = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.2, 1, 0.3).getHex(),
});
const cylinderMaterial = new THREE.MeshPhongMaterial({ color: 0x44aaff });

// Add visual elements to ThreeNode
function addVisuals(node: ThreeNode, isMajor = false) {
  let cylinder;
  // Only add cylinder if node has a parent (root node doesn't need one)
  if (node.parent) {
    // Create a cylinder to represent the connection to parent
    const cylinderGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 16);
    cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

    // Rotate cylinder so its height is along the Z axis (will be aligned later)
    cylinder.rotateX(Math.PI / 2);
    node.add(cylinder);
  }
  const centerGeom = new THREE.SphereGeometry(0.125);
  const center = new THREE.Mesh(centerGeom, centerMaterial);
  center.position.copy(node.worldToLocal(node.worldPosition));
  node.add(center);

  // Add a small disk to represent the node itself
  const diskGeometry = new THREE.CylinderGeometry(
    0.3 * (isMajor ? 2 : 1),
    0.3 * (isMajor ? 2 : 1),
    0.05,
    32,
  );
  const disk = new THREE.Mesh(
    diskGeometry,
    isMajor ? diskMaterialMajor : diskMaterial,
  );
  disk.rotateX(Math.PI / 2);
  node.add(disk);

  // Create a cone to represent the up vector
  const coneGeometry = new THREE.ConeGeometry(0.2, 1, 16);
  const upCone = new THREE.Mesh(coneGeometry, coneMaterial);

  // Position the cone at the node's position initially
  // (Will be updated in updateVisuals)
  node.add(upCone);

  // Store references to the visual elements
  (node as any).visuals = {
    cylinder,
    disk,
    upCone,
  };

  // Initial update of visuals
  updateVisuals(node);

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
const rootNode = new ThreeNode({
  id: 'root',
  position: { x: 0, y: 0, z: 0 },
});
addVisuals(rootNode);
scene.add(rootNode);

// First level children
const child1 = new ThreeNode({
  id: 'child1',
  position: { x: 5, y: 0, z: 0 },
});
addVisuals(child1, true);
rootNode.add(child1);

const child2 = new ThreeNode({
  id: 'child2',
  position: { x: -3, y: 8, z: 4 },
});
addVisuals(child2, true);
rootNode.add(child2);

const child3 = new ThreeNode({
  id: 'child3',
  position: { x: 0, y: -5, z: -6 },
});
addVisuals(child3, true);
rootNode.add(child3);

// Second level children (grandchildren)
const grandchild1 = new ThreeNode({
  id: 'grandchild1',
  position: { x: 2, y: 0, z: 0 },
});
addVisuals(grandchild1);
child1.add(grandchild1);

const grandchild2 = new ThreeNode({
  id: 'grandchild2',
  position: { x: 0, y: 0, z: 2 },
});
addVisuals(grandchild2);
child1.add(grandchild2);

const grandchild3 = new ThreeNode({
  id: 'grandchild3',
  position: { x: 0, y: 2, z: 0 },
});
addVisuals(grandchild3);
child2.add(grandchild3);

const grandchild4 = new ThreeNode({
  id: 'grandchild4',
  position: { x: 2, y: 0, z: 0 },
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

  [child1, child2, child3].forEach((child: ThreeNode) => {
    child.rotateAroundParent(Math.PI / 200);
  });
  [grandchild1, grandchild2, grandchild3, grandchild4].forEach(
    (gc: ThreeNode) => {
      gc.rotateAroundParent(Math.PI / 50);
    },
  );

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

// Update visual elements to match node
function updateVisuals(node: ThreeNode) {
  if ((node as any).visuals) {
    const visuals = (node as any).visuals;
    visuals.upCone.position.copy({
      x: 0,
      y: 1,
      z: 0,
    });

    // Rotate the cone so its tip points up (along Y-axis)
    // The default cone in Three.js points along the Y-axis already,
    // but we need to make sure it points away from the node
    // visuals.upCone.rotateY(-Math.PI / 2);
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
