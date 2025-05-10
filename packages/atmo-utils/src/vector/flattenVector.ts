import { Vector3 } from 'three';

const MAX_STEPS = 5;
const MIN_DOT = 0.01;
const DEFAULT_RADIUS = 6371; // Default Earth radius in km
/**
 * Flatten a vector to be tangential to a sphere at a given position
 *
 * This is useful for ensuring that velocities are tangential to a planet's surface,
 * which is physically realistic for objects moving on a sphere.
 *
 * @param vectorOrParams - Either a Vector3 or an object with vector, position, radius, and threshold
 * @param positionOrUndefined - If vectorOrParams is a Vector3, this is the position
 * @param radiusOrUndefined - If vectorOrParams is a Vector3, this is the radius
 * @param thresholdOrUndefined - If vectorOrParams is a Vector3, this is the threshold
 * @returns A new Vector3 that is tangential to the sphere
 */
export function flattenVector(
  vectorOrParams:
    | Vector3
    | {
        vector: Vector3;
        position: Vector3;
        radius: number;
        threshold?: number;
      },
  positionOrUndefined?: Vector3,
  radiusOrUndefined?: number,
  thresholdOrUndefined?: number
): Vector3 {
  // Handle both calling styles
  let vector: Vector3;
  let position: Vector3;
  let radius: number;
  let threshold: number = 1 / 200;

  if (vectorOrParams instanceof Vector3) {
    // Called with individual parameters
    vector = vectorOrParams;
    position = positionOrUndefined as Vector3;
    radius = radiusOrUndefined || DEFAULT_RADIUS;
    threshold = thresholdOrUndefined || threshold;
  } else {
    // Called with an object parameter
    const params = vectorOrParams;
    vector = params.vector;
    position = params.position;
    radius = params.radius;
    threshold = params.threshold || threshold;
  }

  // Reality checks to ensure parameters are valid
  if (!vector) {
    throw new Error('flattenVector: vector parameter is undefined or null');
  }

  if (!position) {
    throw new Error('flattenVector: position parameter is undefined or null');
  }

  if (!(vector instanceof Vector3)) {
    throw new Error(
      `flattenVector: vector parameter is not a Vector3 instance. Got: ${typeof vector}`
    );
  }

  if (!(position instanceof Vector3)) {
    throw new Error(
      `flattenVector: position parameter is not a Vector3 instance. Got: ${typeof position}`
    );
  }

  if (typeof radius !== 'number' || isNaN(radius) || radius <= 0) {
    throw new Error(
      `flattenVector: radius parameter must be a positive number. Got: ${radius}`
    );
  }

  const magnitude = vector.length();
  if (Math.abs(position.length() - radius) / radius > 0.1) {
    // Recursively call with adjusted position
    if (vectorOrParams instanceof Vector3) {
      // If called with individual parameters, call the same way
      return flattenVector(
        vector,
        position.clone().setLength(radius),
        radius,
        threshold
      );
    } else {
      // If called with an object parameter, call the same way
      return flattenVector({
        vector,
        position: position.clone().setLength(radius),
        radius,
        threshold,
      });
    }
  }
  let steps = 0;
  if (
    vector.length() < 0.1 ||
    Math.abs(position.clone().normalize().dot(vector.clone().normalize())) <
      MIN_DOT
  )
    return new Vector3(0, 0, 0);
  let newVector = vector.clone();
  do {
    const target = position.clone().add(newVector);
    target.setLength(radius);
    newVector.copy(target.clone().sub(position));
    newVector.setLength(magnitude);
    ++steps;
  } while (
    Math.abs(newVector.clone().add(position).length() - radius) / radius >
      threshold &&
    steps < MAX_STEPS
  );
  return newVector;
}
