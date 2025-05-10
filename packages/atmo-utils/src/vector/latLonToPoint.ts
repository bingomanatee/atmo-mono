import { Vector3 } from 'three';

export function latLonToPoint(lat: number, lon: number, radius: number = 1) {
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.cos(lat) * Math.sin(lon);
  const z = Math.sin(lat);
  return new Vector3(x, y, z).multiplyScalar(radius);
}