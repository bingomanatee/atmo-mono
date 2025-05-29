import * as THREE from 'three';
import type { SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { PlateVisualizerBase } from './PlateVisualizerBase';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';

// Define the density range and corresponding hue/lightness ranges (same as platelets)
const MIN_DENSITY = 2.5; // g/cm³ (typical continental crust)
const MAX_DENSITY = 3.5; // g/cm³ (typical oceanic crust)
const MIN_HUE = 0; // Red (for lower density, continental-like)
const MAX_HUE = 0.75; // Bluish-purple (for higher density, oceanic-like)
const MIN_LIGHTNESS = 0.2; // Adjusted lower lightness bound
const MAX_LIGHTNESS = 0.5; // Adjusted upper lightness bound

/**
 * Visualizes a plate as a cylinder and displays forces acting on it.
 */
export class ForceVisualizer extends PlateVisualizerBase {
  private plateMesh: THREE.Mesh | null = null;
  private forceArrow: THREE.ArrowHelper | null = null;
  private orbitalFrame: ThreeOrbitalFrame;

  constructor(scene: THREE.Scene, planetRadius: number, plate: SimPlateIF) {
    super(scene, planetRadius, plate);

    // Create orbital frame for this plate
    this.orbitalFrame = new ThreeOrbitalFrame({
      radius: planetRadius,
      velocity: 0, // Static for force visualization
      axis: new THREE.Vector3(0, 1, 0), // Default axis
    });
    this.orbitalFrame.name = `PlateFrame_${plate.id}`;

    // Add the orbital frame to the scene
    this.addObjectToScene(this.orbitalFrame);
  }

  /**
   * Initializes the visualization for the plate (cylinder).
   */
  public visualize(): void {
    // Create a cylinder mesh for the plate
    const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32);

    // Calculate color based on plate density (same as platelets)
    const normalizedDensity = THREE.MathUtils.mapLinear(
      this.plate.density,
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
      MIN_LIGHTNESS, // Note the inverted order for lightness
    );

    // Vary saturation for visual interest (same as platelets)
    const saturation = 0.3 + Math.random() * 0.3; // 0.3-0.6 range

    const plateColor = new THREE.Color().setHSL(hue, saturation, lightness);

    // Use the same material as platelets with calculated color
    const cylinderMaterial = new THREE.MeshPhongMaterial({
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      shininess: 30,
      color: plateColor,
    });

    this.plateMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

    // Enable shadows for the plate cylinder
    this.plateMesh.castShadow = true;
    this.plateMesh.receiveShadow = true;

    // Position the cylinder within the orbital frame using worldToLocal
    if (this.plate.position) {
      // Convert world position to local position within the orbital frame
      const worldPos = new THREE.Vector3(
        this.plate.position.x,
        this.plate.position.y,
        this.plate.position.z,
      );
      const localPos = this.orbitalFrame.worldToLocal(worldPos.clone());

      this.plateMesh.position.copy(localPos);
    }

    // Orient the cylinder to point outwards from the planet's center (in local space)
    this.plateMesh.lookAt(new THREE.Vector3(0, 0, 0)); // Point towards the center
    this.plateMesh.rotateX(Math.PI / 2); // Rotate to make cylinder point outwards

    // Scale the cylinder based on plate radius and thickness
    // Both plate radius and thickness are already in kilometers
    const plateRadiusScaled = this.plate.radius; // Already in km
    const plateThicknessScaled = this.plate.thickness; // Already in km

    this.plateMesh.scale.set(
      plateRadiusScaled,
      plateThicknessScaled,
      plateRadiusScaled,
    );

    // Add the cylinder to the orbital frame, not directly to the scene
    this.orbitalFrame.add(this.plateMesh);
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

    // Update plate mesh position within the orbital frame
    if (this.plateMesh && currentPlate.position) {
      // Convert world position to local position within the orbital frame
      const worldPos = new THREE.Vector3(
        currentPlate.position.x,
        currentPlate.position.y,
        currentPlate.position.z,
      );
      const localPos = this.orbitalFrame.worldToLocal(worldPos.clone());
      this.plateMesh.position.copy(localPos);

      // Re-orient the cylinder as the position changes (in local space)
      this.plateMesh.lookAt(new THREE.Vector3(0, 0, 0));
      this.plateMesh.rotateX(Math.PI / 2);
    }

    // Update or create force arrow
    const force = forces.get(this.plate.id);

    if (force && force.length() > 0.001 && currentPlate.position) {
      // Only show arrow if there's significant force
      const worldPos = new THREE.Vector3(
        currentPlate.position.x,
        currentPlate.position.y,
        currentPlate.position.z,
      );
      const localOrigin = this.orbitalFrame.worldToLocal(worldPos.clone());
      const direction = force.clone().normalize();
      const length = Math.max(force.length() * 10000, 100); // Much larger scale for visibility
      const color = 0xff0000; // Red color for repulsion

      if (this.forceArrow) {
        // Update existing arrow
        this.forceArrow.position.copy(localOrigin);
        this.forceArrow.setDirection(direction);
        this.forceArrow.setLength(length);
        // Color is constant for now, could be updated based on force magnitude later
      } else {
        // Create new arrow within the orbital frame
        this.forceArrow = new THREE.ArrowHelper(
          direction,
          localOrigin,
          length,
          color,
        );
        this.orbitalFrame.add(this.forceArrow);
      }
    } else {
      // Remove force arrow if no significant force exists or it was previously shown
      if (this.forceArrow) {
        this.orbitalFrame.remove(this.forceArrow);
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
      this.orbitalFrame.remove(this.plateMesh);
      this.plateMesh.geometry.dispose();
      (this.plateMesh.material as THREE.Material).dispose();
      this.plateMesh = null;
    }
    if (this.forceArrow) {
      this.orbitalFrame.remove(this.forceArrow);
      this.forceArrow.dispose();
      this.forceArrow = null;
    }
    // Remove the orbital frame from the scene
    this.removeObjectFromScene(this.orbitalFrame);
  }
}
