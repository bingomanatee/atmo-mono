import { Vector3, type Vector3Like } from 'three';

export function pointsEqual(a: Vector3Like, b: Vector3Like, epsilon = 0.1) {
  if (a.x === b.x && a.y === b.y && a.z === b.z) {
    return true;
  }
  return new Vector3().copy(a).sub(b).length() < epsilon;
}
