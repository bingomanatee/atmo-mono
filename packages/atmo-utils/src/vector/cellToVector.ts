import { Vector3 } from 'three';
import { cellToLatLng, cellToLatLngSync } from '../h3/h3.utils.ts';
import { latLonToPoint } from './latLonToPoint.ts';
import { h3Cache } from '../h3/h3-cache.ts';

/**
 * Convert an H3 cell to a 3D position on a sphere
 * Uses IndexedDB cache for faster lookups when available
 *
 * @param h3Index - H3 cell index
 * @param radius - Radius of the sphere
 * @returns Vector3 position
 */
export async function cellToVector(
  h3Index: string,
  radius: number = 1,
): Promise<Vector3> {
  // Try to get from cache first
  const cachedPoint = await h3Cache.getCellPoint(h3Index, radius);
  if (cachedPoint) {
    return cachedPoint;
  }

  // Compute using the sync version
  const point = cellToVectorSync(h3Index, radius);

  // Cache the result
  h3Cache.setCellPoint(h3Index, radius, point);

  return point;
}

/**
 * Synchronous version of cellToVector for backward compatibility
 * Does not use caching
 *
 * @param h3Index - H3 cell index
 * @param radius - Radius of the sphere
 * @returns Vector3 position
 */
export function cellToVectorSync(h3Index: string, radius: number = 1): Vector3 {
  // Get the lat/lng of the cell center
  const { lat, lng } = cellToLatLngSync(h3Index);

  // Convert lat/lng to radians
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  // Use latLonToPoint to convert to 3D coordinates
  return latLonToPoint(latRad, lngRad, radius);
}
