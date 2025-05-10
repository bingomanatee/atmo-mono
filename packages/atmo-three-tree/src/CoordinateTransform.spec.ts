import { describe, it, expect } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { ThreeTree } from './ThreeTree';
import { pointsEqual } from './utils';

describe('Coordinate Transformations', () => {
  it('should transform points between world and local coordinates in a complex hierarchy', () => {
    const tree = new ThreeTree();
    
    // Create a hierarchy of nodes with different positions and orientations
    const root = tree.createNode({
      id: 'root',
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 } // Identity
    });
    
    const level1 = tree.createNode({
      id: 'level1',
      parentId: 'root',
      position: { x: 10, y: 0, z: 0 },
      // 90 degrees around Y axis
      orientation: { x: 0, y: 0.7071, z: 0, w: 0.7071 }
    });
    
    const level2 = tree.createNode({
      id: 'level2',
      parentId: 'level1',
      position: { x: 0, y: 5, z: 0 },
      // 90 degrees around X axis
      orientation: { x: 0.7071, y: 0, z: 0, w: 0.7071 }
    });
    
    // Create a set of test points in world space
    const worldPoints = [
      new Vector3(0, 0, 0),    // Origin
      new Vector3(1, 0, 0),    // Unit X
      new Vector3(0, 1, 0),    // Unit Y
      new Vector3(0, 0, 1),    // Unit Z
      new Vector3(10, 5, 0),   // At level2's origin
      new Vector3(15, 10, 5),  // Random point
    ];
    
    // Transform each point to level2's local space and back
    for (const worldPoint of worldPoints) {
      // World to local
      const localPoint = level2.worldToLocal(worldPoint);
      
      // Local back to world
      const backToWorld = level2.localToWorld(localPoint);
      
      // The point should be the same after the round trip
      expect(backToWorld.x).toBeCloseTo(worldPoint.x);
      expect(backToWorld.y).toBeCloseTo(worldPoint.y);
      expect(backToWorld.z).toBeCloseTo(worldPoint.z);
    }
  });
  
  it('should handle complex rotations correctly', () => {
    const tree = new ThreeTree();
    
    // Create a node with a complex orientation
    const node = tree.createNode({
      id: 'complex',
      position: { x: 5, y: 5, z: 5 },
      // 45 degrees around each axis
      orientation: {
        x: 0.3826,
        y: 0.3826,
        z: 0.3826,
        w: 0.7071
      }
    });
    
    // Test point
    const worldPoint = new Vector3(10, 10, 10);
    
    // Transform to local space
    const localPoint = node.worldToLocal(worldPoint);
    
    // Transform back to world space
    const backToWorld = node.localToWorld(localPoint);
    
    // Should get back the original point
    expect(backToWorld.x).toBeCloseTo(worldPoint.x);
    expect(backToWorld.y).toBeCloseTo(worldPoint.y);
    expect(backToWorld.z).toBeCloseTo(worldPoint.z);
  });
  
  it('should transform a set of points and preserve their relative positions', () => {
    const tree = new ThreeTree();
    
    // Create a node with an offset and rotation
    const node = tree.createNode({
      id: 'node',
      position: { x: 10, y: 0, z: 0 },
      // 90 degrees around Y
      orientation: { x: 0, y: 0.7071, z: 0, w: 0.7071 }
    });
    
    // Create a set of points forming a triangle in world space
    const worldPoints = [
      new Vector3(15, 0, 0),
      new Vector3(15, 0, 5),
      new Vector3(15, 5, 0),
    ];
    
    // Calculate distances between points in world space
    const worldDistances = [
      worldPoints[0].distanceTo(worldPoints[1]),
      worldPoints[1].distanceTo(worldPoints[2]),
      worldPoints[2].distanceTo(worldPoints[0]),
    ];
    
    // Transform to local space
    const localPoints = worldPoints.map(p => node.worldToLocal(p));
    
    // Calculate distances in local space
    const localDistances = [
      localPoints[0].distanceTo(localPoints[1]),
      localPoints[1].distanceTo(localPoints[2]),
      localPoints[2].distanceTo(localPoints[0]),
    ];
    
    // Distances should be preserved
    for (let i = 0; i < 3; i++) {
      expect(localDistances[i]).toBeCloseTo(worldDistances[i]);
    }
    
    // Transform back to world space
    const backToWorldPoints = localPoints.map(p => node.localToWorld(p));
    
    // Points should be the same after the round trip
    for (let i = 0; i < 3; i++) {
      expect(backToWorldPoints[i].x).toBeCloseTo(worldPoints[i].x);
      expect(backToWorldPoints[i].y).toBeCloseTo(worldPoints[i].y);
      expect(backToWorldPoints[i].z).toBeCloseTo(worldPoints[i].z);
    }
  });
});
