import { describe, it, expect } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { TreeNode } from './TreeNode';
import { pointsEqual } from './utils';

describe('TreeNode', () => {
  it('should create a node with default values', () => {
    const node = new TreeNode({ id: 'test' });
    
    expect(node.id).toBe('test');
    expect(node.parentId).toBeUndefined();
    expect(node.parent).toBeUndefined();
    expect(node.children).toEqual([]);
    
    // Default position should be at origin
    const position = node.position;
    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
    expect(position.z).toBe(0);
    
    // Default orientation should be identity quaternion
    const orientation = node.orientation;
    expect(orientation.x).toBe(0);
    expect(orientation.y).toBe(0);
    expect(orientation.z).toBe(0);
    expect(orientation.w).toBe(1);
  });
  
  it('should create a node with specified position and orientation', () => {
    const node = new TreeNode({
      id: 'test',
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 1, w: 0 } // 180 degrees around Z
    });
    
    const position = node.position;
    expect(position.x).toBe(1);
    expect(position.y).toBe(2);
    expect(position.z).toBe(3);
    
    const orientation = node.orientation;
    expect(orientation.x).toBe(0);
    expect(orientation.y).toBe(0);
    expect(orientation.z).toBe(1);
    expect(orientation.w).toBe(0);
  });
  
  it('should set position using Vector3 or Point3D', () => {
    const node = new TreeNode({ id: 'test' });
    
    // Set using Vector3
    node.setPosition(new Vector3(1, 2, 3));
    expect(node.position.x).toBe(1);
    expect(node.position.y).toBe(2);
    expect(node.position.z).toBe(3);
    
    // Set using Point3D
    node.setPosition({ x: 4, y: 5, z: 6 });
    expect(node.position.x).toBe(4);
    expect(node.position.y).toBe(5);
    expect(node.position.z).toBe(6);
  });
  
  it('should set orientation using Quaternion or Orientation', () => {
    const node = new TreeNode({ id: 'test' });
    
    // Set using Quaternion
    const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI/2);
    node.setOrientation(quat);
    expect(node.orientation.x).toBeCloseTo(0);
    expect(node.orientation.y).toBeCloseTo(0.7071, 4);
    expect(node.orientation.z).toBeCloseTo(0);
    expect(node.orientation.w).toBeCloseTo(0.7071, 4);
    
    // Set using Orientation
    node.setOrientation({ x: 0, y: 0, z: 1, w: 0 });
    expect(node.orientation.x).toBe(0);
    expect(node.orientation.y).toBe(0);
    expect(node.orientation.z).toBe(1);
    expect(node.orientation.w).toBe(0);
  });
  
  it('should handle parent-child relationships', () => {
    const parent = new TreeNode({ id: 'parent' });
    const child = new TreeNode({ id: 'child' });
    
    parent.addChild(child);
    
    expect(parent.children).toContain(child);
    expect(child.parent).toBe(parent);
    expect(child.parentId).toBe('parent');
    
    parent.removeChild(child);
    
    expect(parent.children).not.toContain(child);
    expect(child.parent).toBeUndefined();
    expect(child.parentId).toBeUndefined();
  });
  
  it('should transform points from local to world space', () => {
    const parent = new TreeNode({
      id: 'parent',
      position: { x: 10, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 } // Identity
    });
    
    const child = new TreeNode({
      id: 'child',
      position: { x: 5, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 } // Identity
    });
    
    parent.addChild(child);
    
    // Local point in child's space
    const localPoint = new Vector3(1, 2, 3);
    
    // Transform to world space
    const worldPoint = child.localToWorld(localPoint);
    
    // Expected: parent position + child position + local point
    expect(worldPoint.x).toBeCloseTo(16); // 10 + 5 + 1
    expect(worldPoint.y).toBeCloseTo(2);
    expect(worldPoint.z).toBeCloseTo(3);
  });
  
  it('should transform points from world to local space', () => {
    const parent = new TreeNode({
      id: 'parent',
      position: { x: 10, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 } // Identity
    });
    
    const child = new TreeNode({
      id: 'child',
      position: { x: 5, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 } // Identity
    });
    
    parent.addChild(child);
    
    // World point
    const worldPoint = new Vector3(16, 2, 3);
    
    // Transform to child's local space
    const localPoint = child.worldToLocal(worldPoint);
    
    // Expected: world point - (parent position + child position)
    expect(localPoint.x).toBeCloseTo(1); // 16 - (10 + 5)
    expect(localPoint.y).toBeCloseTo(2);
    expect(localPoint.z).toBeCloseTo(3);
  });
  
  it('should handle rotations in coordinate transformations', () => {
    const parent = new TreeNode({
      id: 'parent',
      position: { x: 0, y: 0, z: 0 },
      // 90 degrees around Y axis
      orientation: { x: 0, y: 0.7071, z: 0, w: 0.7071 }
    });
    
    const child = new TreeNode({
      id: 'child',
      position: { x: 1, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 } // Identity
    });
    
    parent.addChild(child);
    
    // Local point in child's space
    const localPoint = new Vector3(0, 0, 1);
    
    // Transform to world space
    const worldPoint = child.localToWorld(localPoint);
    
    // With parent rotated 90° around Y, the child's local Z axis points along world X
    // and the child's local X axis points along negative world Z
    // So child position (1,0,0) in parent space becomes (0,0,-1) in world space
    // And local point (0,0,1) becomes (1,0,0) in world space
    // Total: (1,0,-1)
    expect(worldPoint.x).toBeCloseTo(1);
    expect(worldPoint.y).toBeCloseTo(0);
    expect(worldPoint.z).toBeCloseTo(-1);
    
    // Now test world to local
    const worldToLocalPoint = child.worldToLocal(worldPoint);
    expect(worldToLocalPoint.x).toBeCloseTo(0);
    expect(worldToLocalPoint.y).toBeCloseTo(0);
    expect(worldToLocalPoint.z).toBeCloseTo(1);
  });
  
  it('should convert between world and local coordinates correctly', () => {
    // Create a more complex hierarchy
    const root = new TreeNode({
      id: 'root',
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    const level1 = new TreeNode({
      id: 'level1',
      position: { x: 10, y: 0, z: 0 },
      // 45 degrees around Y
      orientation: { x: 0, y: 0.3826, z: 0, w: 0.9238 }
    });
    
    const level2 = new TreeNode({
      id: 'level2',
      position: { x: 0, y: 5, z: 0 },
      // 45 degrees around X
      orientation: { x: 0.3826, y: 0, z: 0, w: 0.9238 }
    });
    
    root.addChild(level1);
    level1.addChild(level2);
    
    // Test point
    const testPoint = { x: 1, y: 1, z: 1 };
    
    // Transform from level2 local to world
    const worldPoint = level2.localToWorld(testPoint);
    
    // Transform back to level2 local
    const localPoint = level2.worldToLocal(worldPoint);
    
    // Should get back the original point
    expect(localPoint.x).toBeCloseTo(testPoint.x);
    expect(localPoint.y).toBeCloseTo(testPoint.y);
    expect(localPoint.z).toBeCloseTo(testPoint.z);
  });
  
  it('should handle world position and orientation setters', () => {
    const parent = new TreeNode({
      id: 'parent',
      position: { x: 10, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    const child = new TreeNode({ id: 'child' });
    parent.addChild(child);
    
    // Set world position
    child.setWorldPosition({ x: 15, y: 5, z: 0 });
    
    // Local position should be (5, 5, 0) relative to parent
    expect(child.position.x).toBeCloseTo(5);
    expect(child.position.y).toBeCloseTo(5);
    expect(child.position.z).toBeCloseTo(0);
    
    // World position should be what we set
    const worldPos = child.worldPosition;
    expect(worldPos.x).toBeCloseTo(15);
    expect(worldPos.y).toBeCloseTo(5);
    expect(worldPos.z).toBeCloseTo(0);
    
    // Set world orientation (90 degrees around Y)
    child.setWorldOrientation({ x: 0, y: 0.7071, z: 0, w: 0.7071 });
    
    // World orientation should be what we set
    const worldRot = child.worldOrientation;
    expect(worldRot.x).toBeCloseTo(0);
    expect(worldRot.y).toBeCloseTo(0.7071, 4);
    expect(worldRot.z).toBeCloseTo(0);
    expect(worldRot.w).toBeCloseTo(0.7071, 4);
  });
  
  it('should convert to and from data objects', () => {
    const node = new TreeNode({
      id: 'test',
      parentId: 'parent',
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 1, w: 0 }
    });
    
    const data = node.toData();
    
    expect(data.id).toBe('test');
    expect(data.parentId).toBe('parent');
    expect(data.position.x).toBe(1);
    expect(data.position.y).toBe(2);
    expect(data.position.z).toBe(3);
    expect(data.orientation.x).toBe(0);
    expect(data.orientation.y).toBe(0);
    expect(data.orientation.z).toBe(1);
    expect(data.orientation.w).toBe(0);
    
    // Update from new data
    node.updateFromData({
      id: 'test',
      parentId: 'newParent',
      position: { x: 4, y: 5, z: 6 },
      orientation: { x: 1, y: 0, z: 0, w: 0 }
    });
    
    expect(node.parentId).toBe('newParent');
    expect(node.position.x).toBe(4);
    expect(node.position.y).toBe(5);
    expect(node.position.z).toBe(6);
    expect(node.orientation.x).toBe(1);
    expect(node.orientation.y).toBe(0);
    expect(node.orientation.z).toBe(0);
    expect(node.orientation.w).toBe(0);
  });
});
