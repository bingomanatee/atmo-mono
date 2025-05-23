import { latLngToCell } from 'h3-js';
import { Vector3 } from 'three';
import { pointToLatLon } from './pointToLatLon';
import { PlateletManager } from '@wonderlandlabs/atmo-plates';

/**
 * Given a position (Vector3) and a sphere radius, return the H3 cell index at the given resolution.
 * @param position - Vector3 position on the sphere
 * @param radius - Sphere radius
 * @param resolution - H3 resolution (defaults to PlateletManager.PLATELET_CELL_LEVEL)
 */
export function getH3CellForPosition(
  position: Vector3,
  radius: number,
  resolution = PlateletManager.PLATELET_CELL_LEVEL,
): string {
  const { lat, lon } = pointToLatLon(position, radius);
  return latLngToCell(lat, lon, resolution);
}
