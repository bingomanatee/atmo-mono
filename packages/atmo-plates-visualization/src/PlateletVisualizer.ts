import * as THREE from 'three';
import { Vector3 } from 'three';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { PlateletManager, type SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS, varyP } from '@wonderlandlabs/atmo-utils';
import { PlateVisualizerBase } from './PlateVisualizerBase';
import { log } from './utils';
import { asyncIterToMap } from '@wonderlandlabs/multiverse';

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

    // If instance count changed, recreate the mesh
    if (this.instancedMesh && this.instancedMesh.count !== platelets.length) {
      log(
        `🔄 Recreating mesh: ${this.instancedMesh.count} → ${platelets.length} instances`,
      );
      this.recreateInstancedMesh(platelets.length);
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
      `✅ Mesh updated: ${platelets.length} instances, visible: ${this.instancedMesh.visible}`,
    );
  }

  /**
   * Recreate the InstancedMesh with a new instance count
   */
  private recreateInstancedMesh(newCount: number): void {
    if (!this.instancedMesh) {
      log(`⚠️ No existing mesh to recreate for plate ${this.plate.id}`);
      return;
    }

    const oldCount = this.instancedMesh.count;
    log(
      `🔄 Recreating mesh for plate ${this.plate.id}: ${oldCount} → ${newCount} instances`,
    );

    // Remove old mesh from orbital frame
    this.orbitalFrame.remove(this.instancedMesh);
    log(`   ✅ Removed old mesh from orbital frame`);

    // Dispose of old resources
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
    log(`   ✅ Disposed old geometry and material`);

    // Create new geometry and material
    const { geometry, material } = this.createGeometryAndMaterial();

    // Create new InstancedMesh with correct count
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, newCount);
    this.instancedMesh.name = `PlateletMesh_${this.plate.id}`;
    log(`   ✅ Created new InstancedMesh with ${newCount} instances`);

    // Add new mesh to orbital frame
    this.orbitalFrame.add(this.instancedMesh);
    log(`   ✅ Added new mesh to orbital frame`);

    log(`🔄 Mesh recreation complete for plate ${this.plate.id}`);
  }

  /**
   * Create the initial mesh (called from refreshColors if needed)
   */
  private async createInitialMesh(plateletCount: number): Promise<void> {
    // Create geometry and material
    const { geometry, material } = this.createGeometryAndMaterial();

    // Create InstancedMesh with the actual platelet count
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      plateletCount,
    );
    this.instancedMesh.name = `PlateletMesh_${this.plate.id}`;

    // Add new mesh to orbital frame
    this.orbitalFrame.add(this.instancedMesh);

    log(`🔧 Created initial mesh with ${plateletCount} instances`);
  }

  /**
   * Create initial visualization without regenerating platelets
   */
  public async createInitialVisualization(): Promise<void> {
    const platelets = await this.platelets();
    if (platelets.length === 0) {
      log(
        `⚠️ No platelets found for plate ${this.plate.id} - skipping visualization`,
      );
      return;
    }

    await this.createInitialMesh(platelets.length);
    await this.updateMeshInstances();

    log(
      `✅ Created initial visualization for plate ${this.plate.id} with ${platelets.length} platelets`,
    );
  }

  /**
   * Initialize platelets asynchronously and set up the mesh
   */
  public async initializeAsync(): Promise<void> {
    // Read existing platelets from the database (don't regenerate!)
    log(
      `🔍 Reading existing platelets for plate ${this.plate.id} from database...`,
    );

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
    const platelets = await this.platelets();
    if (platelets.length === 0) {
      log(`⚠️ No platelets to refresh colors for plate ${this.plate.id}`);
      return;
    }

    // If no mesh exists yet, create it (since we skipped initializeAsync)
    if (!this.instancedMesh) {
      log(
        `🔧 Creating initial mesh for plate ${this.plate.id} with ${platelets.length} platelets`,
      );
      await this.createInitialMesh(platelets.length);
    }
    // If instance count changed, recreate the mesh
    else if (this.instancedMesh.count !== platelets.length) {
      log(
        `🔄 Recreating mesh for color refresh: ${this.instancedMesh.count} → ${platelets.length} instances`,
      );
      this.recreateInstancedMesh(platelets.length);
    }

    if (!this.instancedMesh) {
      log(`⚠️ Failed to create instancedMesh for plate ${this.plate.id}`);
      return;
    }

    log(`🎨 Refreshing colors for ${platelets.length} platelets`);

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

    // Update the mesh instances with new data
    await this.updateMeshInstances();

    log(
      `✅ Colors refreshed for plate ${this.plate.id}: ${platelets.length} instances`,
    );
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
    // Read platelets directly from database (post-deletion state)
    const platelets = await this.plateletManager.plateletsCollection.find(
      'plateId',
      this.plate.id,
    );
    const map = await asyncIterToMap(platelets);
    const result = Array.from(map.values());

    log(
      `🔍 platelets() for plate ${this.plate.id}: found ${result.length} platelets in database`,
    );

    return result;
  }
}
