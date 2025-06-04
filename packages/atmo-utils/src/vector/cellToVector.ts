import { Vector3 } from 'three';
import { EARTH_RADIUS } from '../h3/constants';
import { cellToLatLng } from '../h3/h3.utils.ts';
import { h3Cache } from '../h3/h3cache';
import { latLonToPoint } from './latLonToPoint.ts';

/**
 * Convert an H3 cell to a 3D position on a sphere
 *
 * @param h3Index - H3 cell index
 * @param radius - Radius of the sphere
 * @returns Vector3 position
 */
export function cellToVector(h3Index: string, radius: number = 1): Vector3 {
  // Get the lat/lng of the cell center
  const { lat, lng } = cellToLatLng(h3Index);

  // Convert lat/lng to radians
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  // Use latLonToPoint to convert to 3D coordinates
  return latLonToPoint(latRad, lngRad, radius);
}

export async function cellToVectorAsync(
  h3Index: string,
  radius: number = 1,
): Vector3 {
  // Get the lat/lng of the cell center

  if (h3Cache.canUseIndexedDB) {
    const storedPoint = await h3Cache.getCellPoint(h3Index);
    if (storedPoint) {
      if (radius === EARTH_RADIUS) return storedPoint;
      storedPoint.setLength(radius);
      return storedPoint;
    }
  }

  // Use latLonToPoint to convert to 3D coordinates
  const point = cellToVector(h3Index, radius);
  if (h3Cache.canUseIndexedDB) {
    const storedPoint = point.clone().setLength(EARTH_RADIUS);
    h3Cache.setCellPoint(h3Index, storedPoint);
  }
  return point;
}
