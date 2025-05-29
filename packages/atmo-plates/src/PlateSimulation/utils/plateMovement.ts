import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { Object3D, Vector3 } from 'three';

/**
 * Creates an orbital frame for plate movement
 * The frame is positioned at the origin (0,0,0)
 * The plate's position is represented by a proxy object in the frame
 */
export function createOrbitalFrame(
  currentStep: { speed: number; velocity: Vector3 },
  planet: { radius: number },
) {
  // Create frame at origin
  const frame = new ThreeOrbitalFrame({
    axis: currentStep.velocity.clone().normalize(),
    velocity: currentStep.speed * planet.radius, // Scale velocity by radius
    radius: planet.radius,
    // orbitalAngle is not needed and has been removed
  });

  return frame;
}

/**
 * Moves a plate along its orbital path
 * @param currentStep The current step containing speed, velocity, and position
 * @param planet The planet containing radius
 * @returns The new position of the plate
 */
export function movePlate(
  currentStep: { speed: number; velocity: Vector3; position: Vector3 },
  planet: { radius: number },
) {
  // Create orbital frame at origin
  const frame = createOrbitalFrame(currentStep, planet);

  // Create a proxy object at the plate's initial position
  const plateProxy = new Object3D();
  plateProxy.position.copy(currentStep.position);
  frame.add(plateProxy);

  // Move the orbital frame
  frame.orbit();

  // Get the new global position of the proxy object
  const newPosition = plateProxy.position.clone();
  frame.localToWorld(newPosition);

  return newPosition;
}
