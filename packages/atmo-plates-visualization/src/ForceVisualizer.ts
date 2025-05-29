import * as THREE from 'three';
import type { SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { PlateVisualizerBase } from './PlateVisualizerBase';

/**
 * Visualizes a plate as a cylinder and displays forces acting on it.
 */
export class ForceVisualizer extends PlateVisualizerBase {
  private plateMesh: THREE.Mesh | null = null;
  private forceArrow: THREE.ArrowHelper | null = null;

  constructor(scene: THREE.Scene, planetRadius: number, plate: SimPlateIF) {
    super(scene, planetRadius, plate);
  }

  /**
   * Initializes the visualization for the plate (cylinder).
   */
  public visualize(): void {
    // Create a cylinder mesh for the plate
    const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32);
    const cylinderMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa }); // Default grey color

    this.plateMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

    // Position the cylinder at the plate's initial position on the sphere
    this.plateMesh.position.copy(this.plate.position as THREE.Vector3);

    // Orient the cylinder to point outwards from the planet's center
    this.plateMesh.lookAt(new THREE.Vector3(0, 0, 0)); // Point towards the center
    this.plateMesh.rotateX(Math.PI / 2); // Rotate to make cylinder point outwards

    // Scale the cylinder based on plate radius and thickness
    const plateRadiusScaled = this.plate.radius * this.planetRadius; // Convert plate radius from radians to linear distance
    const plateThicknessScaled = this.plate.thickness * 1000; // Convert thickness from km to meters

    this.plateMesh.scale.set(
      plateRadiusScaled,
      plateThicknessScaled,
      plateRadiusScaled,
    );

    // Add to scene
    this.addObjectToScene(this.plateMesh);
  }

  /**
   * Updates the visualization for the plate and its forces.
   * @param plates - All plates in the simulation (needed to find the current plate data).
   * @param forces - Map of plate ID to force vector.
   */
  public update(
    plates: SimPlateIF[],
    forces: Map<string, THREE.Vector3>,
  ): void {
    // Find the current plate data in the updated plates array
    const currentPlate = plates.find((p) => p.id === this.plate.id);
    if (!currentPlate) {
      console.warn(`Plate ${this.plate.id} not found in updated plates.`);
      return;
    }

    // Update plate mesh position
    if (this.plateMesh) {
      this.plateMesh.position.copy(currentPlate.position as THREE.Vector3);
      // Re-orient the cylinder as the position changes
      this.plateMesh.lookAt(new THREE.Vector3(0, 0, 0));
      this.plateMesh.rotateX(Math.PI / 2);
    }

    // Update or create force arrow
    const force = forces.get(this.plate.id);

    if (force && force.length() > 0.001) {
      // Only show arrow if there's significant force
      const origin = currentPlate.position as THREE.Vector3;
      const direction = force.clone().normalize();
      const length = force.length() * 1000; // Scale force vector length for visibility
      const color = 0xff0000; // Red color for repulsion

      if (this.forceArrow) {
        // Update existing arrow
        this.forceArrow.position.copy(origin);
        this.forceArrow.setDirection(direction);
        this.forceArrow.setLength(length);
        // Color is constant for now, could be updated based on force magnitude later
      } else {
        // Create new arrow
        this.forceArrow = new THREE.ArrowHelper(
          direction,
          origin,
          length,
          color,
        );
        this.addObjectToScene(this.forceArrow);
      }
    } else {
      // Remove force arrow if no significant force exists or it was previously shown
      if (this.forceArrow) {
        this.removeObjectFromScene(this.forceArrow);
        this.forceArrow.dispose(); // Dispose resources
        this.forceArrow = null;
      }
    }
  }

  /**
   * Clears the visualization for the plate and its force arrow.
   */
  public clear(): void {
    if (this.plateMesh) {
      this.removeObjectFromScene(this.plateMesh);
      this.plateMesh.geometry.dispose();
      (this.plateMesh.material as THREE.Material).dispose();
      this.plateMesh = null;
    }
    if (this.forceArrow) {
      this.removeObjectFromScene(this.forceArrow);
      this.forceArrow.dispose();
      this.forceArrow = null;
    }
  }
}
