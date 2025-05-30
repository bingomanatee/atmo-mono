import './style.css';
import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  PlateletManager,
  PlateSimulation,
  type SimPlateIF,
} from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils'; // Use the correct Earth radius in meters
import { Vector3 } from 'three';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';

// Define the density range and corresponding hue/lightness ranges
const MIN_DENSITY = 2700;
const MAX_DENSITY = 3000;
const MIN_HUE = 0; // Red
const MAX_HUE = 0.75; // Bluish-purple
const MIN_LIGHTNESS = 0.3; // Lower lightness for higher density
const MAX_LIGHTNESS = 0.8; // Higher lightness for lower density

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
export const OVERFLOW = 1.05;

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  1,
  100000000,
);
camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS * 1.5, EARTH_RADIUS * 2);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 5, 5).normalize();
scene.add(directionalLight);

// Add planet sphere (Earth representation)
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

// --- Simulation Setup ---
// Initialize simulation with 1 plate
const sim = new PlateSimulation({ plateCount: 1 });
sim.init();

// Get the single plate (assuming there's only one)
const plate = sim.simUniv.get('plates').values().next().value[1];

// Create an orbital frame for the plate
const testPlate = new ThreeOrbitalFrame({
  velocity: 10, // Increased velocity
  radius: EARTH_RADIUS,
});
scene.add(testPlate);

// Generate platelets for the test plate
const manager = sim.managers.get('plateletManager');
const platelets = manager.generatePlatelets(plate.id);

// Create a single geometry and material for all platelets

// Create a standard cylinder geometry (includes side, top, and bottom caps)
const fullCylinderGeometry = new THREE.CylinderGeometry(
  1,
  1,
  1,
  18,
  undefined,
  false,
); // Ensure caps are generated initially

// Create a new buffer geometry to hold only the side and top cap
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', fullCylinderGeometry.attributes.position);
geometry.setAttribute('normal', fullCylinderGeometry.attributes.normal);
geometry.setAttribute('uv', fullCylinderGeometry.attributes.uv);

// Copy the indices for the side and top cap groups
if (fullCylinderGeometry.index) {
  const indexArray = fullCylinderGeometry.index.array;
  // CylinderGeometry groups: 0 = side, 1 = top cap, 2 = bottom cap
  // We want to include groups 0 and 1.
  const sideGroup = fullCylinderGeometry.groups.find(
    (group) => group.materialIndex === 0,
  );
  const topCapGroup = fullCylinderGeometry.groups.find(
    (group) => group.materialIndex === 1,
  );

  if (sideGroup && topCapGroup) {
    const sideIndices = indexArray.slice(
      sideGroup.start,
      sideGroup.start + sideGroup.count,
    );
    const topCapIndices = indexArray.slice(
      topCapGroup.start,
      topCapGroup.start + topCapGroup.count,
    );

    // Combine the indices
    const newIndexArray = new Uint16Array(
      sideIndices.length + topCapIndices.length,
    );
    newIndexArray.set(sideIndices, 0);
    newIndexArray.set(topCapIndices, sideIndices.length);

    geometry.setIndex(new THREE.BufferAttribute(newIndexArray, 1));
  } else {
    console.warn(
      'Could not find expected geometry groups in CylinderGeometry.',
    );
    // Fallback: use the full geometry if groups are not as expected
    if (fullCylinderGeometry.index) {
      geometry.setIndex(
        new THREE.BufferAttribute(fullCylinderGeometry.index.array, 1),
      );
    }
  }
} else {
  console.warn(
    'CylinderGeometry does not have an index buffer. Cannot remove caps selectively.',
  );
  // Fallback: use the full geometry
  // Attributes are already copied, so no need to do anything else
}

const material = new THREE.MeshPhongMaterial({
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.8,
  shininess: 30,
  vertexColors: true, // Enable vertex colors for instancing
});

const instancedMesh = new THREE.InstancedMesh(
  geometry,
  material,
  platelets.length,
);
testPlate.add(instancedMesh); // Add to orbital frame

// Create matrices for each instance
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const localMatrix = new THREE.Matrix4();

platelets.forEach((platelet, index) => {
  // Position relative to the orbital frame (which is at the planet origin)
  position.copy(platelet.position);

  // Set scale (x,z scale by the platelet's radius, y scales by thickness in km)
  scale.set(
    platelet.radius * OVERFLOW,
    platelet.thickness,
    platelet.radius * OVERFLOW,
  );

  // Rotation to make Y-axis point outward
  const direction = platelet.position.clone().normalize();
  const outwardRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), // Initial orientation of cylinder height along Y
    direction, // Desired outward direction
  );
  quaternion.copy(outwardRotation);

  // Compose local matrix
  localMatrix.compose(position, quaternion, scale);

  // Set instance matrix
  instancedMesh.setMatrixAt(index, localMatrix);

  // Set instance color based on density
  // Clamp density to the defined range and normalize to a 0-1 value
  const normalizedDensity = THREE.MathUtils.mapLinear(
    platelet.density,
    MIN_DENSITY,
    MAX_DENSITY,
    0,
    1,
  );

  // Map the normalized density to the hue range (0 for min density, 0.75 for max density)
  const hue = THREE.MathUtils.mapLinear(
    normalizedDensity,
    0,
    1,
    MIN_HUE,
    MAX_HUE,
  );

  // Map the normalized density to the lightness range (0.8 for min density, 0.3 for max density)
  const lightness = THREE.MathUtils.mapLinear(
    normalizedDensity,
    0,
    1,
    MAX_LIGHTNESS,
    MIN_LIGHTNESS, // Note the inverted order for lightness
  );

  // Vary saturation randomly for visual interest
  const saturation = 0.7 + Math.random() * 0.3; // 0.7-1.0

  const instanceColor = new THREE.Color().setHSL(hue, saturation, lightness);

  // Set instance color
  instancedMesh.setColorAt(index, instanceColor);
});

// Update the rendering for instanced mesh colors
instancedMesh.instanceColor.needsUpdate = true;

// Add a cone to the orbital frame to visualize orientation
const coneGeometry = new THREE.ConeGeometry(
  EARTH_RADIUS * 0.05,
  EARTH_RADIUS * 0.1,
  16,
);
const coneMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 }); // Yellow
const cone = new THREE.Mesh(coneGeometry, coneMaterial);
cone.position.set(0, EARTH_RADIUS, 0); // Position at the top of the planet in the orbital frame
cone.lookAt(new THREE.Vector3(0, 0, 0)); // Point the cone towards the origin
cone.rotateX(Math.PI / 2); // Adjust rotation to point outward along Y-axis initially
testPlate.add(cone);

// Animation loop
const animate = () => {
  requestAnimationFrame(animate);

  // Update controls
  controls.update();

  // Orbit the test plate frame
  testPlate.orbit();

  // Render scene
  renderer.render(scene, camera);
};

animate();

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
