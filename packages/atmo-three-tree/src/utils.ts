import { Vector3, Quaternion } from 'three';
import { Orientation, Point3D } from './types';

/**
 * Convert a Point3D object to a Vector3
 */
export function pointToVector3(point: Point3D): Vector3 {
  return new Vector3(point.x, point.y, point.z);
}

/**
 * Convert a Vector3 to a Point3D object
 */
export function vector3ToPoint(vector: Vector3): Point3D {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z
  };
}

/**
 * Create a Quaternion from an Orientation object
 */
export function quaternionFromOrientation(orientation: Orientation): Quaternion {
  return new Quaternion(
    orientation.x,
    orientation.y,
    orientation.z,
    orientation.w
  );
}

/**
 * Convert a Quaternion to an Orientation object
 */
export function quaternionToOrientation(quaternion: Quaternion): Orientation {
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w
  };
}

/**
 * Calculate the difference between two points
 */
export function pointDifference(a: Point3D, b: Point3D): Point3D {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z
  };
}

/**
 * Calculate the distance between two points
 */
export function pointDistance(a: Point3D, b: Point3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if two points are approximately equal
 */
export function pointsEqual(a: Point3D, b: Point3D, tolerance: number = 1e-6): boolean {
  return pointDistance(a, b) <= tolerance;
}

/**
 * Check if two orientations are approximately equal
 */
export function orientationsEqual(a: Orientation, b: Orientation, tolerance: number = 1e-6): boolean {
  // Convert to quaternions for proper comparison
  const quatA = quaternionFromOrientation(a);
  const quatB = quaternionFromOrientation(b);
  
  // Calculate dot product (cosine of angle between quaternions)
  const dot = Math.abs(
    quatA.x * quatB.x + 
    quatA.y * quatB.y + 
    quatA.z * quatB.z + 
    quatA.w * quatB.w
  );
  
  // If dot is close to 1, the quaternions are nearly identical
  return dot >= (1 - tolerance);
}
