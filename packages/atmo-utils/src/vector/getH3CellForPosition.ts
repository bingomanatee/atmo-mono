import { Vector3 } from 'three';
import { latLngToCell } from 'h3-js';
import { pointToLatLon } from './pointToLatLon';

/**
 * Given a position (Vector3) and a sphere radius, return the H3 cell index at the given resolution.
 * @param position - Vector3 position on the sphere
 * @param radius - Sphere radius
 * @param resolution - H3 resolution
 */
export function getH3CellForPosition(
  position: Vector3,
  radius: number,
  resolution: number,
): string {
  const { lat, lon } = pointToLatLon(position, radius);
  // latLngToCell expects latitude, longitude, resolution
  return latLngToCell(lat, lon, resolution);
}
