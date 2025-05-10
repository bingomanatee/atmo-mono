import { Vector3 } from 'three';
import { cellToLatLng } from '../h3/h3.utils.ts';
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
