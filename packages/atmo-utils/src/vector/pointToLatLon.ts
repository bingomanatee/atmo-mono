import { Vector3 } from 'three';

/**
 * Convert a 3D point (Vector3) to latitude and longitude in degrees.
 * @param point - Vector3 position
 * @param radius - Sphere radius (optional, defaults to point.length())
 * @returns { lat, lon } in degrees
 */
export function pointToLatLon(
  point: Vector3,
  radius?: number,
): { lat: number; lon: number } {
  let p = point;
  let r = typeof radius === 'number' ? radius : point.length();
  if (typeof radius === 'number' && Math.abs(point.length() - radius) > 1e-6) {
    p = point.clone().setLength(radius);
  }
  // Standard spherical coordinates: lat from y, lon from z and x
  const lat = (Math.asin(p.y / r) * 180) / Math.PI;
  const lon = (Math.atan2(p.z, p.x) * 180) / Math.PI;
  return { lat, lon };
}
