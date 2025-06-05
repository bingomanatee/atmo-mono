import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';

export interface ThreeJsContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  planet: THREE.Mesh;
  lightHelper: THREE.DirectionalLightHelper;
  axesHelper: THREE.AxesHelper;
}

export interface AnimationCallbacks {
  onUpdate?: () => void;
  onRender?: () => void;
}

export class ThreeJsSetup {
  private context: ThreeJsContext;
  private animationId: number | null = null;
  private callbacks: AnimationCallbacks = {};

  constructor() {
    this.context = this.initializeThreeJs();
    this.setupEventListeners();
  }

  private initializeThreeJs(): ThreeJsContext {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111122);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      EARTH_RADIUS * 3,
    );
    camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS * 1.5, EARTH_RADIUS * 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    this.setupLighting(scene);
    const planet = this.createPlanet(scene);
    const lightHelper = this.createLightHelper(scene);
    const axesHelper = this.createAxesHelper(scene);

    return {
      scene,
      camera,
      renderer,
      controls,
      planet,
      lightHelper,
      axesHelper,
    };
  }

  private setupLighting(scene: THREE.Scene): void {
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
  }

  private createPlanet(scene: THREE.Scene): THREE.Mesh {
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
    return planet;
  }

  private createLightHelper(scene: THREE.Scene): THREE.DirectionalLightHelper {
    const directionalLight = scene.children.find(
      (child) =>
        child instanceof THREE.DirectionalLight && child.intensity === 2,
    ) as THREE.DirectionalLight;

    const lightHelper = new THREE.DirectionalLightHelper(
      directionalLight,
      EARTH_RADIUS / 2,
    );
    scene.add(lightHelper);
    return lightHelper;
  }

  private createAxesHelper(scene: THREE.Scene): THREE.AxesHelper {
    const axesHelper = new THREE.AxesHelper(EARTH_RADIUS * 0.5);
    scene.add(axesHelper);
    return axesHelper;
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => {
      this.context.camera.aspect = window.innerWidth / window.innerHeight;
      this.context.camera.updateProjectionMatrix();
      this.context.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public getContext(): ThreeJsContext {
    return this.context;
  }

  public setAnimationCallbacks(callbacks: AnimationCallbacks): void {
    this.callbacks = callbacks;
  }

  public startAnimation(): void {
    if (this.animationId !== null) {
      return;
    }

    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      this.context.controls.update();

      if (this.callbacks.onUpdate) {
        this.callbacks.onUpdate();
      }

      this.context.renderer.render(this.context.scene, this.context.camera);

      if (this.callbacks.onRender) {
        this.callbacks.onRender();
      }
    };

    animate();
  }

  public stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public dispose(): void {
    this.stopAnimation();

    this.context.renderer.dispose();
    this.context.controls.dispose();

    if (this.context.renderer.domElement.parentNode) {
      this.context.renderer.domElement.parentNode.removeChild(
        this.context.renderer.domElement,
      );
    }
  }
}
