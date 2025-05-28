import * as THREE from 'three';
import { Vector3 } from 'three';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { PlateletManager, type SimPlateIF } from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';

// Define the density range and corresponding hue/lightness ranges
const MIN_DENSITY = 2700;
const MAX_DENSITY = 3000;
const MIN_HUE = 0; // Red
const MAX_HUE = 0.75; // Bluish-purple
const MIN_LIGHTNESS = 0.3; // Lower lightness for higher density
const MAX_LIGHTNESS = 0.8; // Higher lightness for lower density

export class PlateVisualizer {
  public readonly orbitalFrame: ThreeOrbitalFrame;
  private readonly instancedMesh: THREE.InstancedMesh;
  private readonly plate: SimPlateIF;
  private readonly platelets: any[]; // Using 'any' for now
  private readonly plateletManager: PlateletManager;
  // plateHue is no longer needed as color is per platelet based on density

  constructor(plate: SimPlateIF, plateletManager: PlateletManager) {
    // Removed plateHue parameter
    this.plate = plate;
    this.plateletManager = plateletManager;

    // Create orbital frame for this plate at the world/scene origin (0,0,0)
    this.orbitalFrame = new ThreeOrbitalFrame({
      // Axis and velocity will eventually be dynamic based on simulation data
      axis: new Vector3(0, 1, 0), // Example: Initial rotation axis (Y-axis)
      velocity: Math.random() * 0.1 + 0.01, // Example: Random slow initial angular velocity
      radius: EARTH_RADIUS, // Use Earth radius as the orbital radius for the frame's rotation calculation (although the frame itself is at origin)
    });
    this.orbitalFrame.name = `PlateFrame_${plate.id}`;
    // Ensure the frame is at the origin
    this.orbitalFrame.position.set(0, 0, 0);
    this.orbitalFrame.quaternion.identity();

    // Generate platelets for this specific plate
    this.platelets = this.plateletManager.generatePlatelets(this.plate.id);

    // Create a single geometry and material for all platelets (shared)
    // This should ideally be created once outside the class if performance is critical

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

    const material = new THREE.MeshPhongMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      shininess: 30,
      vertexColors: true,
    });

    // Create instanced mesh for this plate's platelets
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.platelets.length,
    );
    this.instancedMesh.name = `PlateletMesh_${plate.id}`;

    // Create matrices for each instance
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    // localMatrix is relative to the orbitalFrame, which is at the origin
    const localMatrix = new THREE.Matrix4();
    const OVERFLOW = 1.05; // Define OVERFLOW locally or import if needed

    // Set up each instance's matrix relative to the plate's orbital frame (at origin)
    this.platelets.forEach((platelet, index) => {
      // The platelet position from the simulation is already its world position relative to the origin (0,0,0).
      // Since the orbital frame is also at the origin, this is the platelet's position relative to the orbital frame.
      position.copy(platelet.position);

      // Set scale (x,z scale by the platelet's radius, y scales by thickness in km)
      scale.set(
        platelet.radius * OVERFLOW,
        platelet.thickness,
        platelet.radius * OVERFLOW,
      );

      // Rotation to make Y-axis point outward from the origin
      const direction = platelet.position.clone().normalize();
      const outwardRotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), // Initial orientation of cylinder height along Y
        direction, // Desired outward direction
      );

      // If the plate has an orientation in the simulation, we would combine it here with outwardRotation.
      // For now, we only apply the outward rotation to align the platelet normal with the spherical surface.
      quaternion.copy(outwardRotation);

      // The local matrix for the instance is its transformation relative to the orbital frame (at origin).
      // Since the orbital frame is at the origin, the local matrix is composed using the platelet's world position.
      localMatrix.compose(position, quaternion, scale);

      // Set instance matrix
      this.instancedMesh.setMatrixAt(index, localMatrix);

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

      const instanceColor = new THREE.Color().setHSL(
        hue,
        saturation,
        lightness,
      );

      // Set instance color
      this.instancedMesh.setColorAt(index, instanceColor);
    });

    if (this.instancedMesh.instanceColor) {
      // Update the rendering for instanced mesh colors
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    // Add instanced mesh to the plate's orbital frame (at origin)
    this.orbitalFrame.add(this.instancedMesh);

    // Optional: Add a visual marker for the plate's origin (the orbital frame's position)
    // const originMarker = new THREE.Mesh(new THREE.SphereGeometry(1000, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    // this.orbitalFrame.add(originMarker);
  }

  // Method to add the plate's orbital frame to a scene
  addToScene(scene: THREE.Scene): void {
    scene.add(this.orbitalFrame);
  }

  // Method to update the visualizer in the animation loop
  update(): void {
    // The orbitalFrame is at the origin (0,0,0). Its orbit() method rotates it around the origin.
    // This rotation will affect all its children (the instanced mesh), causing the plate and its platelets to rotate together.
    this.orbitalFrame.orbit();

    // If the simulation provides updated orientation for the plate itself (not just rotation),
    // we would update the orbitalFrame's quaternion here.

    // Note: If platelet positions or orientations relative to the plate change significantly in the simulation,
    // we would need to update the instance matrices here. For now, we assume their positions are stable
    // within the plate's frame once generated and their world position comes directly from the simulation.
    // The orbitalFrame's rotation handles the plate's movement as a whole.
  }
}
