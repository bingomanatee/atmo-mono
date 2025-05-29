import * as THREE from 'three';
import { Vector3 } from 'three';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { PlateletManager, type SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS, varyP } from '@wonderlandlabs/atmo-utils';
import { PlateVisualizerBase } from './PlateVisualizerBase'; // Import the base class

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
  private readonly instancedMesh: THREE.InstancedMesh;
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

    // Get existing platelets from the simulation (they should already be generated and processed)
    this.platelets = this.getExistingPlatelets();

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

    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.platelets.length,
    );
    this.instancedMesh.name = `PlateletMesh_${this.plate.id}`;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const localMatrix = new THREE.Matrix4();
    const OVERFLOW = 1.05;

    this.platelets.forEach((platelet, index) => {
      position.copy(platelet.position);
      scale.set(
        platelet.radius * OVERFLOW,
        platelet.thickness,
        platelet.radius * OVERFLOW,
      );
      const direction = platelet.position.clone().normalize();
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
  }

  public visualize(): void {
    this.addObjectToScene(this.orbitalFrame);
    this.orbitalFrame.add(this.instancedMesh);
  }

  public update(): void {
    this.orbitalFrame.orbit();
  }

  public clear(): void {
    this.removeObjectFromScene(this.orbitalFrame);
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }

  /**
   * Get existing platelets for this plate from the simulation
   */
  private getExistingPlatelets(): any[] {
    const platelets: any[] = [];
    const plateletsCollection =
      this.plateletManager['sim'].simUniv.get('platelets');

    if (plateletsCollection) {
      plateletsCollection.each((platelet: any) => {
        if (platelet.plateId === this.plate.id) {
          platelets.push(platelet);
        }
      });
    }

    return platelets;
  }
}
