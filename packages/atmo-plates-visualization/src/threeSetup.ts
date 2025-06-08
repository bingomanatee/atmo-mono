// src/utils/threeSetup.ts
import * as THREE from 'three';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ThreeSetup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  planet: THREE.Mesh;
  lightHelper: THREE.DirectionalLightHelper;
}

export function createThreeScene(): ThreeSetup {
  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111122);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    EARTH_RADIUS * 3,
  );
  camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS * 1.5, EARTH_RADIUS * 2);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(
    EARTH_RADIUS * 2,
    EARTH_RADIUS * 2,
    EARTH_RADIUS * 2,
  );
  scene.add(directionalLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 1);
  backLight.position.set(
    -EARTH_RADIUS * 5,
    -EARTH_RADIUS * 5,
    -EARTH_RADIUS * 5,
  );
  scene.add(backLight);

  const lightHelper = new THREE.DirectionalLightHelper(
    directionalLight,
    EARTH_RADIUS / 2,
  );
  scene.add(lightHelper);

  // Planet sphere
  const planetGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32);
  const planetMaterial = new THREE.MeshPhongMaterial({
    color: 0x2233ff,
    transparent: true,
    opacity: 0.3,
    wireframe: true,
    wireframeLinewidth: 50,
  });
  const planet = new THREE.Mesh(planetGeometry, planetMaterial);
  planet.position.set(0, 0, 0);
  scene.add(planet);

  // Axes helper
  const axesHelper = new THREE.AxesHelper(EARTH_RADIUS * 0.5);
  scene.add(axesHelper);

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    scene,
    camera,
    renderer,
    controls,
    planet,
    lightHelper,
  };
}
