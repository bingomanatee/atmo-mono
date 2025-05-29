import * as THREE from 'three';
import type { SimPlateIF } from '@wonderlandlabs/atmo-plates';

/**
 * Base class for plate visualization components.
 * Provides common properties like scene and planet radius.
 */
export class PlateVisualizerBase {
  protected scene: THREE.Scene;
  protected planetRadius: number;
  protected plate: SimPlateIF;

  constructor(scene: THREE.Scene, planetRadius: number, plate: SimPlateIF) {
    this.scene = scene;
    this.planetRadius = planetRadius;
    this.plate = plate;
  }

  /**
   * Abstract method to initialize the visualization for the plate.
   * To be implemented by derived classes.
   */
  public visualize(): void {
    throw new Error(
      'visualize() method must be implemented by derived classes.',
    );
  }

  /**
   * Abstract method to update the visualization for the plate.
   * To be implemented by derived classes.
   * @param plates - All plates in the simulation (for inter-plate visualization).
   * @param forces - Map of forces (if visualizing forces).
   */
  public update(
    plates?: SimPlateIF[],
    forces?: Map<string, THREE.Vector3>,
  ): void {
    throw new Error('update() method must be implemented by derived classes.');
  }

  /**
   * Abstract method to clear the visualization for the plate.
   * To be implemented by derived classes.
   */
  public clear(): void {
    throw new Error('clear() method must be implemented by derived classes.');
  }

  /**
   * Helper method to add a Three.js object to the scene.
   * @param object - The object to add.
   */
  protected addObjectToScene(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  /**
   * Helper method to remove a Three.js object from the scene.
   * @param object - The object to remove.
   */
  protected removeObjectFromScene(object: THREE.Object3D): void {
    this.scene.remove(object);
  }
}
