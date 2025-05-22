import { randomNormal } from '@wonderlandlabs/atmo-utils/dist';
import * as THREE from 'three';
import { CylinderGeometry, Object3D, Vector3, type Vector3Like } from 'three';

export function isThreeNode(a: unknown): a is ThreeOrbitalFrame {
  return a instanceof ThreeOrbitalFrame;
}
export interface ThreeNodeProps {
  velocity?: number;
  radius?: number;
  parent?: ThreeOrbitalFrame;
  name?: string;
  axis?: Vector3Like;
  orbitalAngle?: number;
}
const plateMat = new THREE.MeshPhongMaterial({
  color: new THREE.Color(0.2, 0.5, 1).getHex(),
});
/**
 * A class extending Three.js Object3D with additional utility methods
 * for working with positions and orientations in different formats
 */
export class ThreeOrbitalFrame extends Object3D {
  /**
   * Create a new ThreeOrbitalFrame
   */
  constructor(data: ThreeNodeProps = {}) {
    const { velocity, radius, axis, orbitalAngle } = data;
    super();
    this.velocity = velocity ?? 1;
    this.radius = radius ?? 1;
    this.axis = new Vector3().copy(axis ?? randomNormal());
    this.orbitalAngle = orbitalAngle ?? Math.random() * 2 * Math.PI;
  }

  velocity: number;
  radius: number;
  axis: Vector3;
  orbitalAngle: number;

  orbit() {
    this.rotateOnAxis(this.axis, this.velocity / this.radius);
  }

  // @tdprecated do not use / test
  visualize() {
    const plate = new CylinderGeometry(
      this.radius / 5,
      this.radius / 5,
      this.radius / 100,
    );
    const plateObj = new THREE.Mesh(plate, plateMat);
    const plateContainer = new Object3D();
    plateObj.rotateX(Math.PI / 2);
    plateContainer.add(plateObj);
    plateContainer.position.copy(this.pointOnOrbit());
    this.add(plateContainer);
    plateContainer.lookAt(new Vector3());
  }

  // @deprecated do not use
  pointOnOrbit(): Vector3 {
    const up = new Vector3(0, 1, 0);
    if (Math.abs(this.axis.clone().dot(up)) > 0.99) up.set(1, 0, 0); // fallback

    const tangent = new Vector3().crossVectors(this.axis, up).normalize();
    const bitangent = new Vector3()
      .crossVectors(this.axis, tangent)
      .normalize();

    return tangent
      .multiplyScalar(Math.cos(this.orbitalAngle))
      .add(bitangent.multiplyScalar(Math.sin(this.orbitalAngle)))
      .multiplyScalar(this.radius);
  }
}
