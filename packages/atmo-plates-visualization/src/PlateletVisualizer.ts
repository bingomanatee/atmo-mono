import * as THREE from 'three';
import { Vector3 } from 'three';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { PlateletManager, type SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS, varyP } from '@wonderlandlabs/atmo-utils';
import { PlateVisualizerBase } from './PlateVisualizerBase';
import { log } from './utils';
import { asyncIterToMap } from '@wonderlandlabs/multiverse/dist'; // Import the base class

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
  private readonly plateletManager: PlateletManager;
  protected plate: SimPlateIF;
  constructor(
    scene: THREE.Scene,
    planetRadius: number,
    plate: SimPlateIF,
    plateletManager: PlateletManager,
  ) {
    super(scene, planetRadius, plate); // Call the base class constructor
    this.plateletManager = plateletManager;
    this.plate = plate;

    this.orbitalFrame = new ThreeOrbitalFrame({
      axis: new Vector3(0, 1, 0),
      velocity: Math.random() * 0.1 + 0.01,
      radius: EARTH_RADIUS,
    });
    this.orbitalFrame.name = `PlateFrame_${this.plate.id}`;
    this.orbitalFrame.position.set(0, 0, 0);
    this.orbitalFrame.quaternion.identity();

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
  private async updateMeshInstances(): void {

    const platelets = await this.platelets();
    if (platelets.length === 0) {
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

    platelets.forEach((platelet, index) => {
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
      if (!platelet.position) {
        console.warn('platelet has no position', platelet);
      } else position.copy(platelet.position);
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

      // Check if this platelet is flagged as deleted or removed
      // Note: In the new injectable architecture, we'll need to pass simulation separately
      // For now, just check the platelet's removed property
      const isDeleted = platelet.removed === true;

      let instanceColor: THREE.Color;

      if (isDeleted) {
        // Color deleted platelets bright red for visualization
        instanceColor = new THREE.Color(0xff0000); // Bright red
        if (index < 3) {
          log(`   🔴 Platelet ${index} is flagged as deleted - coloring red`);
        }
      } else {
        // Normal density-based coloring
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

        instanceColor = new THREE.Color().setHSL(hue, saturation, lightness);
      }

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
     await this.plateletManager.generatePlatelets(this.plate.id);

    // Create geometry and material
    const { geometry, material } = this.createGeometryAndMaterial();

    const platelets = await this.platelets();
    // Create InstancedMesh with the actual platelet count (no more overflow!)
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      platelets.length, // Use actual count instead of hardcoded 100
    );
    this.instancedMesh.name = `PlateletMesh_${this.plate.id}`;
    this.instancedMesh.count = platelets.length;
    return this.updateMeshInstances();
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

  /**
   * Refresh the visualization colors (call after edge detection)
   */
  public async refreshColors() {
    if (this.instancedMesh && this.platelets.length > 0) {
      log(`🎨 Refreshing colors for ${this.platelets.length} platelets`);

      const platelets = await this.platelets();
      // Re-run the color logic from updateMeshInstances
      platelets.forEach((platelet, index) => {
        // Check if platelet is flagged as deleted
        const isDeleted = platelet.removed === true;

        let instanceColor: THREE.Color;

        if (isDeleted) {
          // Color deleted platelets bright red for visualization
          instanceColor = new THREE.Color(0xff0000); // Bright red
          log(
            `   🔴 Platelet ${platelet.id} is flagged as deleted - coloring red`,
          );
        } else {
          // Normal density-based coloring
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

          instanceColor = new THREE.Color().setHSL(hue, saturation, lightness);
        }

        this.instancedMesh!.setColorAt(index, instanceColor);
      });

      // Update the instance colors
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }

      log(`✅ Colors refreshed for plate ${this.plate.id}`);
    }
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
  private async platelets(): Promise<any[]> {
    // Use the PlateletManager to generate platelets for this plate
    // This follows the new injectable architecture
    const platelets = await this.plateletManager.plateletsCollection.find('plateId', this.plate.id);
    const map = await asyncIterToMap(platelets);
    return Array.from(map.values());
  }
}
