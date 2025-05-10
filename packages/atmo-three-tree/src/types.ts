import { Vector3, Quaternion } from 'three';
import { DataKey, DataRecord } from '@wonderlandlabs/multiverse';

/**
 * Interface for a point in 3D space
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

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
  position: Point3D;
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
  orientation: Quaternion;
  
  // World properties
  worldPosition: Vector3;
  worldOrientation: Quaternion;
  
  // Methods
  setPosition(position: Vector3 | Point3D): void;
  setOrientation(orientation: Quaternion | Orientation): void;
  setWorldPosition(position: Vector3 | Point3D): void;
  setWorldOrientation(orientation: Quaternion | Orientation): void;
  
  addChild(node: TreeNodeIF): void;
  removeChild(node: TreeNodeIF): void;
  
  localToWorld(point: Vector3 | Point3D): Vector3;
  worldToLocal(point: Vector3 | Point3D): Vector3;
  
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
