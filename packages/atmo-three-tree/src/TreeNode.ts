import { Vector3, Quaternion, Matrix4 } from 'three';
import { Orientation, Point3D, TreeNodeData, TreeNodeIF } from './types';
import { pointToVector3, quaternionFromOrientation } from './utils';

/**
 * A class representing a node in a 3D hierarchy tree
 */
export class TreeNode implements TreeNodeIF {
  id: string;
  parentId?: string;
  parent?: TreeNodeIF;
  children: TreeNodeIF[] = [];
  
  // Local properties (relative to parent)
  #position: Vector3 = new Vector3();
  #orientation: Quaternion = new Quaternion();
  
  // Cached world transform
  #worldMatrix: Matrix4 = new Matrix4();
  #worldMatrixNeedsUpdate: boolean = true;
  
  constructor(data: Partial<TreeNodeData>) {
    this.id = data.id || crypto.randomUUID();
    this.parentId = data.parentId;
    
    if (data.position) {
      this.setPosition(data.position);
    }
    
    if (data.orientation) {
      this.setOrientation(data.orientation);
    }
  }
  
  /**
   * Get the node's local position
   */
  get position(): Vector3 {
    return this.#position.clone();
  }
  
  /**
   * Get the node's local orientation
   */
  get orientation(): Quaternion {
    return this.#orientation.clone();
  }
  
  /**
   * Set the node's local position
   */
  setPosition(position: Vector3 | Point3D): void {
    if (position instanceof Vector3) {
      this.#position.copy(position);
    } else {
      this.#position.set(position.x, position.y, position.z);
    }
    this.#invalidateWorldMatrix();
  }
  
  /**
   * Set the node's local orientation
   */
  setOrientation(orientation: Quaternion | Orientation): void {
    if (orientation instanceof Quaternion) {
      this.#orientation.copy(orientation);
    } else {
      this.#orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
    }
    this.#invalidateWorldMatrix();
  }
  
  /**
   * Get the node's world position
   */
  get worldPosition(): Vector3 {
    this.#updateWorldMatrix();
    const position = new Vector3();
    position.setFromMatrixPosition(this.#worldMatrix);
    return position;
  }
  
  /**
   * Get the node's world orientation
   */
  get worldOrientation(): Quaternion {
    this.#updateWorldMatrix();
    const rotation = new Quaternion();
    rotation.setFromRotationMatrix(this.#worldMatrix);
    return rotation;
  }
  
  /**
   * Set the node's position using world coordinates
   */
  setWorldPosition(position: Vector3 | Point3D): void {
    const worldPos = position instanceof Vector3 ? position : new Vector3(position.x, position.y, position.z);
    
    if (this.parent) {
      // Convert world position to local position
      const parentWorldMatrix = new Matrix4();
      const parentWorldInverse = new Matrix4();
      
      // Get parent's world matrix
      if (this.parent instanceof TreeNode) {
        (this.parent as TreeNode).#updateWorldMatrix();
        parentWorldMatrix.copy((this.parent as TreeNode).#worldMatrix);
      } else {
        // Fallback for non-TreeNode parents
        const parentWorldPos = this.parent.worldPosition;
        const parentWorldRot = this.parent.worldOrientation;
        
        parentWorldMatrix.compose(
          parentWorldPos,
          parentWorldRot,
          new Vector3(1, 1, 1) // Scale
        );
      }
      
      // Invert parent's world matrix
      parentWorldInverse.copy(parentWorldMatrix).invert();
      
      // Transform world position to local position
      const localPos = worldPos.clone().applyMatrix4(parentWorldInverse);
      this.setPosition(localPos);
    } else {
      // No parent, so world position is the same as local position
      this.setPosition(worldPos);
    }
  }
  
  /**
   * Set the node's orientation using world coordinates
   */
  setWorldOrientation(orientation: Quaternion | Orientation): void {
    const worldRot = orientation instanceof Quaternion ? 
      orientation : 
      quaternionFromOrientation(orientation);
    
    if (this.parent) {
      // Convert world orientation to local orientation
      const parentWorldRot = this.parent.worldOrientation;
      const parentWorldRotInverse = parentWorldRot.clone().invert();
      
      // Local rotation = parent^-1 * world
      const localRot = parentWorldRotInverse.multiply(worldRot);
      this.setOrientation(localRot);
    } else {
      // No parent, so world orientation is the same as local orientation
      this.setOrientation(worldRot);
    }
  }
  
  /**
   * Add a child node to this node
   */
  addChild(node: TreeNodeIF): void {
    if (node.parent) {
      node.parent.removeChild(node);
    }
    
    this.children.push(node);
    node.parent = this;
    node.parentId = this.id;
    
    // Update the child's world transform
    if (node instanceof TreeNode) {
      (node as TreeNode).#invalidateWorldMatrix();
    }
  }
  
  /**
   * Remove a child node from this node
   */
  removeChild(node: TreeNodeIF): void {
    const index = this.children.indexOf(node);
    if (index !== -1) {
      this.children.splice(index, 1);
      node.parent = undefined;
      node.parentId = undefined;
      
      // Update the child's world transform
      if (node instanceof TreeNode) {
        (node as TreeNode).#invalidateWorldMatrix();
      }
    }
  }
  
  /**
   * Transform a point from local to world coordinates
   */
  localToWorld(point: Vector3 | Point3D): Vector3 {
    this.#updateWorldMatrix();
    
    const localPoint = point instanceof Vector3 ? 
      point.clone() : 
      new Vector3(point.x, point.y, point.z);
    
    return localPoint.applyMatrix4(this.#worldMatrix);
  }
  
  /**
   * Transform a point from world to local coordinates
   */
  worldToLocal(point: Vector3 | Point3D): Vector3 {
    this.#updateWorldMatrix();
    
    const worldPoint = point instanceof Vector3 ? 
      point.clone() : 
      new Vector3(point.x, point.y, point.z);
    
    const worldMatrixInverse = this.#worldMatrix.clone().invert();
    return worldPoint.applyMatrix4(worldMatrixInverse);
  }
  
  /**
   * Convert the node to a data object for storage
   */
  toData(): TreeNodeData {
    return {
      id: this.id,
      parentId: this.parentId,
      position: {
        x: this.#position.x,
        y: this.#position.y,
        z: this.#position.z
      },
      orientation: {
        x: this.#orientation.x,
        y: this.#orientation.y,
        z: this.#orientation.z,
        w: this.#orientation.w
      },
      children: this.children.map(child => child.id)
    };
  }
  
  /**
   * Update the node from a data object
   */
  updateFromData(data: TreeNodeData): void {
    if (data.position) {
      this.setPosition(data.position);
    }
    
    if (data.orientation) {
      this.setOrientation(data.orientation);
    }
    
    this.parentId = data.parentId;
  }
  
  /**
   * Mark the world matrix as needing an update
   */
  #invalidateWorldMatrix(): void {
    this.#worldMatrixNeedsUpdate = true;
    
    // Invalidate all children as well
    for (const child of this.children) {
      if (child instanceof TreeNode) {
        (child as TreeNode).#invalidateWorldMatrix();
      }
    }
  }
  
  /**
   * Update the world matrix if needed
   */
  #updateWorldMatrix(): void {
    if (!this.#worldMatrixNeedsUpdate) {
      return;
    }
    
    // Start with local transform
    this.#worldMatrix.compose(
      this.#position,
      this.#orientation,
      new Vector3(1, 1, 1) // Scale
    );
    
    // Apply parent transform if available
    if (this.parent) {
      const parentWorldMatrix = new Matrix4();
      
      if (this.parent instanceof TreeNode) {
        // Get parent's world matrix
        (this.parent as TreeNode).#updateWorldMatrix();
        parentWorldMatrix.copy((this.parent as TreeNode).#worldMatrix);
      } else {
        // Fallback for non-TreeNode parents
        const parentWorldPos = this.parent.worldPosition;
        const parentWorldRot = this.parent.worldOrientation;
        
        parentWorldMatrix.compose(
          parentWorldPos,
          parentWorldRot,
          new Vector3(1, 1, 1) // Scale
        );
      }
      
      // Combine local and parent transforms
      this.#worldMatrix.premultiply(parentWorldMatrix);
    }
    
    this.#worldMatrixNeedsUpdate = false;
  }
}
