import { Vector3, Quaternion, type Vector3Like } from 'three';
import { DataKey, DataRecord } from '@wonderlandlabs/multiverse';

/**
 * Interface for a quaternion representing orientation
 */
export interface Orientation {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Interface for node data stored in the Multiverse collection
 */
export interface TreeNodeData extends DataRecord {
  id: string;
  parentId?: string;
  position: Vector3Like;
  orientation: Orientation;
  children?: string[];
}

/**
 * Interface for a tree node
 */
export interface TreeNodeIF {
  id: string;
  parentId?: string;
  parent?: TreeNodeIF;
  children: TreeNodeIF[];

  // Local properties
  position: Vector3;
  quaternion: Quaternion;

  // World properties
  worldPosition: Vector3;
  worldQuaternion: Quaternion;

  // Methods
  // Use Object3D methods directly for manipulating position and quaternion
  // add(object: Object3D): this;
  // remove(object: Object3D): this;

  localToWorld(point: Vector3Like): Vector3;
  worldToLocal(point: Vector3Like): Vector3;

  toData(): TreeNodeData;
  updateFromData(data: TreeNodeData): void;
}

/**
 * Interface for the tree manager
 */
export interface ThreeTreeIF {
  nodes: Map<string, TreeNodeIF>;

  createNode(data: Partial<TreeNodeData>): TreeNodeIF;
  getNode(id: string): TreeNodeIF | undefined;
  removeNode(id: string): boolean;
  moveNode(id: string, newParentId?: string): boolean;

  toData(): TreeNodeData[];
  fromData(data: TreeNodeData[]): void;
}
