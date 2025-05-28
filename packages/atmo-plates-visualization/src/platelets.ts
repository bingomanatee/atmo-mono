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
  1, // Adjusted near clipping plane
  EARTH_RADIUS * 10, // Increased far clipping plane
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
  velocity: 10, // Much faster rotation
  radius: EARTH_RADIUS,
});

// Add orbital frame to scene
scene.add(orbitalFrame);

// Add a cone to the orbital frame at (0, 0, EARTH_RADIUS) for visual validation
const coneGeometry = new THREE.ConeGeometry(
  EARTH_RADIUS * 0.05,
  EARTH_RADIUS * 0.2,
  32,
);
const coneMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 }); // Yellow color
const cone = new THREE.Mesh(coneGeometry, coneMaterial);
// Position the cone at the plate's position relative to the orbital frame
// The plate's position in simulation is relative to planet center.
// We assume the orbital frame is also at planet center for this single plate example.
// So the cone position should be the plate's position.
cone.position.copy(testPlate.position);
orbitalFrame.add(cone);

// Create platelet manager and generate platelets
const manager = new PlateletManager(sim);
const platelets = manager.generatePlatelets(plateId);

// Get the platelets collection from the simulation
const plateletsCollection = sim.simUniv.get('platelets');
if (!plateletsCollection) throw new Error('platelets collection not found');

// Create a single geometry for all platelets - use a base radius of 1 since we'll scale it per instance
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
    new THREE.Vector3(0, 0, 1), // Assuming default cylinder height is along Z initially
    direction,
  );

  // Then rotate 90 degrees around x-axis to make cylinder stand upright (if height is along Y)
  // Re-evaluating this rotation for a Y-height cylinder.
  // We want the cylinder's Y axis (height) to point outward.
  const correctedRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), // Initial orientation of cylinder height along Y
    direction, // Desired outward direction
  );

  quaternion.copy(correctedRotation);

  // Create world matrix
  worldMatrix.compose(position, quaternion, scale);

  // Convert world matrix to local matrix relative to orbital frame
  localMatrix.copy(worldMatrix);
  localMatrix.premultiply(orbitalFrame.matrixWorld.invert());

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
