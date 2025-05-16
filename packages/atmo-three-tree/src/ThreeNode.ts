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
      this.up.copy(this.localToWorld(new Vector3(0, 1, 0)..sub(this.worldPosiiton).normalize()));
    }
  }

  /**
   * Set the node's local position from either Vector3 or Point3D
   */
  reposition(position: Vector3Like): this {
    this.position.copy(position);
    this.#alignQuaternionToPosition();
    return this;
  }

  get origin() {
    return (
      this.parent ? this.parent.localToWorld(new Vector3()) : this.position
    ).clone();
  }

  #alignQuaternionToPosition() {
    this.lookAt(this.origin);
    const newTarget = this.localToWorld(new Vector3(0, 1, 0));
    const forward = new Vector3();
    this.getWorldDirection(forward); // direction this node is facing
    forward.normalize();

// start with a global up reference
    const worldUp = new Vector3(0, 1, 0);

// get a perpendicular to forward that's as close to worldUp as possible
    const right = new Vector3().crossVectors(worldUp, forward).normalize();

// now get the final orthogonal up vector
    const newUp = new Vector3().crossVectors(forward, right).normalize();
    this.up.copy(newUp);
  }

  get worldPosition() {
    if (this.parent) {
      return this.parent.localToWorld(this.position.clone());
    }
    return this.position.clone();
  }

  get relativeUp() {
    return this.up.clone().add(this.worldPosition);
  }

  get upTarget() {
    return this.worldToLocal(this.relativeUp);
  }

  // @param target - The target point in world coordinates
  set upTarget(target: Vector3) {
    this.up.copy(target.clone().sub(this.worldPosition).normalize());
  }

  rotateAroundParent(radians: number) {
    const frame = new Object3D();
    this.parent?.add(frame);
    const target = new Object3D();
    target.position.copy(this.position);
    frame.add(target);
    frame.rotateOnAxis(this.parent?.up ?? new Vector3(0, 1, 0), radians);

    frame.updateMatrixWorld(true);
    target.updateMatrixWorld(true);

    const newLocal = target.getWorldPosition(new Vector3());

    const newLocalPos = this.parent?.worldToLocal(newLocal) ?? newLocal;
    this.reposition(newLocalPos);
    this.parent?.remove(frame);
  }
}
