import {
  Object3D,
  Vector3,
  Quaternion,
  Matrix4,
  type Vector3Like,
} from 'three';
import { quaternionFromOrientation } from './utils';

export function isThreeNode(a: unknown): a is ThreeNode {
  return a instanceof ThreeNode;
}

export interface ThreeNodeProps {
  position?: Vector3Like;
  up?: Vector3Like;
  parent?: ThreeNode;
  name?: string;
}

/**
 * A class extending Three.js Object3D with additional utility methods
 * for working with positions and orientations in different formats
 */
export class ThreeNode extends Object3D {
  /**
   * Create a new ThreeNode
   */
  constructor(data: ThreeNodeProps = {}) {
    const { position, up, parent, name } = data;
    super();
    if (parent) {
      this.parent = parent;
      this.parent.add(this);
    }
    if (name) {
      this.name = name;
    }
    if (up) this.up.copy(new Vector3().copy(up).clone().normalize());

    if (position) {
      this.position.copy(position);
      this.#alignQuaternionToPosition();
    }
  }

  /**
   * Set the node's local position from either Vector3 or Point3D
   */
  reposition(position: Vector3Like): this {
    const oldTarget = this.upTarget;
    this.position.copy(position);
    this.#alignQuaternionToPosition();
    this.upTarget = this.localToWorld(oldTarget);
    return this;
  }

  get origin() {
    return (
      this.parent ? this.parent.localToWorld(new Vector3()) : this.position
    ).clone();
  }

  #alignQuaternionToPosition() {
    const lookAt = this.worldPosition
      .sub(this.origin)
      .multiplyScalar(2)
      .add(this.origin);
    console.log('looking at ', lookAt, 'from', this.worldPosition);
    this.lookAt(lookAt);
  }

  get worldPosition() {
    if (this.parent) {
      return this.parent.localToWorld(this.position.clone());
    }
    return this.position.clone();
  }

  get upTarget() {
    return this.worldToLocal(this.up.clone().add(this.worldPosition));
  }

  // @param target - The target point in world coordinates
  set upTarget(target: Vector3) {
    this.up.copy(target.clone().sub(this.worldPosition).normalize());
  }
}
