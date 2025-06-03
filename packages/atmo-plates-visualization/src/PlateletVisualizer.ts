import * as THREE from 'three';
import { Vector3 } from 'three';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { PlateletManager, type SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS, varyP } from '@wonderlandlabs/atmo-utils';
import { PlateVisualizerBase } from './PlateVisualizerBase';
import { log } from './utils'; // Import the base class

// Define the density range and corresponding hue/lightness ranges
const MIN_DENSITY = 2.5; // g/cm³ (typical continental crust)
const MAX_DENSITY = 3.5; // g/cm³ (typical oceanic crust)
const MIN_HUE = 0; // Red (for lower density, continental-like)
const MAX_HUE = 0.75; // Bluish-purple (for higher density, oceanic-like)
const MIN_LIGHTNESS = 0.2; // Adjusted lower lightness bound
const MAX_LIGHTNESS = 0.5; // Adjusted upper lightness bound

export class PlateletVisualizer extends PlateVisualizerBase {
  // Inherit from PlateVisualizerBase
  public readonly orbitalFrame: ThreeOrbitalFrame;
  private instancedMesh: THREE.InstancedMesh | null = null; // Will be created in initializeAsync
  private readonly platelets: any[]; // Using 'any' for now
  private readonly plateletManager: PlateletManager;

  constructor(
    scene: THREE.Scene,
    planetRadius: number,
    plate: SimPlateIF,
    plateletManager: PlateletManager,
  ) {
    super(scene, planetRadius, plate); // Call the base class constructor
    this.plateletManager = plateletManager;

    this.orbitalFrame = new ThreeOrbitalFrame({
      axis: new Vector3(0, 1, 0),
      velocity: Math.random() * 0.1 + 0.01,
      radius: EARTH_RADIUS,
    });
    this.orbitalFrame.name = `PlateFrame_${this.plate.id}`;
    this.orbitalFrame.position.set(0, 0, 0);
    this.orbitalFrame.quaternion.identity();

    // Initialize empty platelets array - will be populated in initializeAsync
    this.platelets = [];

    // Note: InstancedMesh will be created in initializeAsync after we know the platelet count
  }

  /**
   * Create the geometry and material for platelet instances
   */
  private createGeometryAndMaterial(): {
    geometry: THREE.BufferGeometry;
    material: THREE.MeshPhongMaterial;
  } {
    const fullCylinderGeometry = new THREE.CylinderGeometry(
      1,
      1,
      1,
      18,
      undefined,
      false,
    );
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', fullCylinderGeometry.attributes.position);
    geometry.setAttribute('normal', fullCylinderGeometry.attributes.normal);
    geometry.setAttribute('uv', fullCylinderGeometry.attributes.uv);

    if (fullCylinderGeometry.index) {
      const indexArray = fullCylinderGeometry.index.array;
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
    }

    const material = new THREE.MeshPhongMaterial({
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      shininess: 30,
    });

    return { geometry, material };
  }

  /**
   * Update the instanced mesh with current platelet data
   */
  private updateMeshInstances(): void {
    log(`🔧 Updating mesh instances for ${this.platelets.length} platelets`);

    if (this.platelets.length === 0) {
      console.warn(`⚠️ No platelets to update mesh for plate ${this.plate.id}`);
      return;
    }

    if (!this.instancedMesh) {
      console.error(
        `⚠️ InstancedMesh not created yet for plate ${this.plate.id}`,
      );
      return;
    }

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const localMatrix = new THREE.Matrix4();
    const OVERFLOW = 1.05;

    this.platelets.forEach((platelet, index) => {
      if (index < 3) {
        // Debug first few platelets
        log(`   Platelet ${index}:`, {
          position: platelet.position,
          radius: platelet.radius,
          thickness: platelet.thickness,
          density: platelet.density,
        });
        log(
          `   Scale will be: (${platelet.radius * OVERFLOW}, ${platelet.thickness}, ${platelet.radius * OVERFLOW})`,
        );
      }
      // Simple positioning - just use platelet position directly
      position.copy(platelet.position);
      scale.set(
        platelet.radius * OVERFLOW,
        platelet.thickness,
        platelet.radius * OVERFLOW,
      );
      const direction = new Vector3().copy(platelet.position).normalize();
      const outwardRotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction,
      );
      quaternion.copy(outwardRotation);
      localMatrix.compose(position, quaternion, scale);
      this.instancedMesh.setMatrixAt(index, localMatrix);

      const normalizedDensity = THREE.MathUtils.mapLinear(
        platelet.density,
        MIN_DENSITY,
        MAX_DENSITY,
        0,
        1,
      );

      const hue = THREE.MathUtils.mapLinear(
        normalizedDensity,
        0,
        1,
        MIN_HUE,
        MAX_HUE,
      );

      const lightness = THREE.MathUtils.mapLinear(
        normalizedDensity,
        0,
        1,
        MAX_LIGHTNESS,
        MIN_LIGHTNESS,
      );

      const saturation = varyP({
        max: 0.6,
        min: 0.3,
      });

      const instanceColor = new THREE.Color().setHSL(
        hue,
        saturation,
        lightness,
      );

      this.instancedMesh.setColorAt(index, instanceColor);
    });

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    log(
      `✅ Mesh updated: ${this.platelets.length} instances, visible: ${this.instancedMesh.visible}, count: ${this.instancedMesh.count}`,
    );
  }

  /**
   * Initialize platelets asynchronously and set up the mesh
   */
  public async initializeAsync(): Promise<void> {
    // Get existing platelets from the simulation
    this.platelets = await this.getExistingPlatelets();

    log(`🔍 Plate ${this.plate.id}: Found ${this.platelets.length} platelets`);

    if (this.platelets.length === 0) {
      console.warn(`⚠️ No platelets found for plate ${this.plate.id}`);
      return;
    }

    // Create geometry and material
    const { geometry, material } = this.createGeometryAndMaterial();

    // Create InstancedMesh with the actual platelet count (no more overflow!)
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.platelets.length, // Use actual count instead of hardcoded 100
    );
    this.instancedMesh.name = `PlateletMesh_${this.plate.id}`;
    this.instancedMesh.count = this.platelets.length;

    log(
      `✅ Created InstancedMesh with ${this.platelets.length} instances (no overflow!)`,
    );

    // Update the mesh with platelet data
    this.updateMeshInstances();
  }

  public visualize(): void {
    log(
      `🎨 Adding plate ${this.plate.id} to scene with ${this.platelets.length} platelets`,
    );
    this.addObjectToScene(this.orbitalFrame);

    // Only add the mesh if it has been created (after initializeAsync)
    if (this.instancedMesh) {
      this.orbitalFrame.add(this.instancedMesh);
    }

    // Add a red sphere at the plate center for debugging (100km radius)
    const plateMarkerGeometry = new THREE.SphereGeometry(100, 8, 6); // 100km radius sphere
    const plateMarkerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Bright red color
      transparent: false, // Make it solid
      opacity: 1.0,
    });
    const plateMarker = new THREE.Mesh(
      plateMarkerGeometry,
      plateMarkerMaterial,
    );

    // Convert global plate position to local coordinates relative to orbital frame
    const localPosition = this.orbitalFrame.worldToLocal(
      new Vector3().copy(this.plate.position),
    );
    plateMarker.position.copy(localPosition);
    plateMarker.name = `PlateMarker_${this.plate.id}`;
    this.orbitalFrame.add(plateMarker);

    log(`   Orbital frame position:`, this.orbitalFrame.position);
    log(`   Plate position:`, this.plate.position);
    if (this.instancedMesh) {
      log(
        `   Mesh visible: ${this.instancedMesh.visible}, count: ${this.instancedMesh.count}`,
      );
    } else {
      log(`   Mesh not yet created`);
    }
  }

  public update(): void {
    this.orbitalFrame.orbit();
  }

  public clear(): void {
    this.removeObjectFromScene(this.orbitalFrame);

    // Only dispose if the mesh exists
    if (this.instancedMesh) {
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
    }
  }

  /**
   * Get existing platelets for this plate from the simulation
   */
  private async getExistingPlatelets(): Promise<any[]> {
    const platelets: any[] = [];
    const plateletsCollection =
      this.plateletManager['sim'].simUniv.get('platelets');

    if (plateletsCollection) {
      // Use the find method to get platelets for this specific plate
      for await (const [id, platelet] of plateletsCollection.find(
        'plateId',
        this.plate.id,
      )) {
        platelets.push(platelet);
      }
    }

    return platelets;
  }
}
