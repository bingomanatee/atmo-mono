import { Vector3 } from 'three';

export function randomNormal() {
 return  new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
}