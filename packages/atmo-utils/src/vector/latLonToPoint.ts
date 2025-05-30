import { Vector3 } from 'three';

export function latLonToPoint(lat: number, lon: number, radius: number = 1) {
  // Standard spherical coordinates: x = r*cos(lat)*cos(lon), y = r*sin(lat), z = r*cos(lat)*sin(lon)
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.sin(lon);
  return new Vector3(x, y, z).multiplyScalar(radius);
}
