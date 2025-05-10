import { describe, it, expect } from 'vitest';
import { Vector3, Quaternion } from 'three';
import {
  pointToVector3,
  vector3ToPoint,
  quaternionFromOrientation,
  quaternionToOrientation,
  pointDifference,
  pointDistance,
  pointsEqual,
  orientationsEqual
} from './utils';

describe('Utility Functions', () => {
  describe('Vector3 Conversions', () => {
    it('should convert Point3D to Vector3', () => {
      const point = { x: 1, y: 2, z: 3 };
      const vector = pointToVector3(point);
      
      expect(vector).toBeInstanceOf(Vector3);
      expect(vector.x).toBe(1);
      expect(vector.y).toBe(2);
      expect(vector.z).toBe(3);
    });
    
    it('should convert Vector3 to Point3D', () => {
      const vector = new Vector3(1, 2, 3);
      const point = vector3ToPoint(vector);
      
      expect(point).toEqual({ x: 1, y: 2, z: 3 });
    });
  });
  
  describe('Quaternion Conversions', () => {
    it('should convert Orientation to Quaternion', () => {
      const orientation = { x: 0, y: 0.7071, z: 0, w: 0.7071 };
      const quaternion = quaternionFromOrientation(orientation);
      
      expect(quaternion).toBeInstanceOf(Quaternion);
      expect(quaternion.x).toBe(0);
      expect(quaternion.y).toBeCloseTo(0.7071);
      expect(quaternion.z).toBe(0);
      expect(quaternion.w).toBeCloseTo(0.7071);
    });
    
    it('should convert Quaternion to Orientation', () => {
      const quaternion = new Quaternion(0, 0.7071, 0, 0.7071);
      const orientation = quaternionToOrientation(quaternion);
      
      expect(orientation).toEqual({
        x: 0,
        y: 0.7071,
        z: 0,
        w: 0.7071
      });
    });
  });
  
  describe('Point Operations', () => {
    it('should calculate point difference', () => {
      const a = { x: 1, y: 2, z: 3 };
      const b = { x: 4, y: 6, z: 8 };
      const diff = pointDifference(a, b);
      
      expect(diff).toEqual({ x: 3, y: 4, z: 5 });
    });
    
    it('should calculate point distance', () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 3, y: 4, z: 0 };
      const distance = pointDistance(a, b);
      
      expect(distance).toBe(5); // 3-4-5 triangle
    });
    
    it('should check if points are equal', () => {
      const a = { x: 1, y: 2, z: 3 };
      const b = { x: 1, y: 2, z: 3 };
      const c = { x: 1.0001, y: 2, z: 3 };
      
      expect(pointsEqual(a, b)).toBe(true);
      expect(pointsEqual(a, c)).toBe(false);
      expect(pointsEqual(a, c, 0.001)).toBe(true); // With tolerance
    });
  });
  
  describe('Orientation Operations', () => {
    it('should check if orientations are equal', () => {
      const a = { x: 0, y: 0, z: 0, w: 1 };
      const b = { x: 0, y: 0, z: 0, w: 1 };
      const c = { x: 0.01, y: 0, z: 0, w: 0.9999 };
      
      expect(orientationsEqual(a, b)).toBe(true);
      expect(orientationsEqual(a, c)).toBe(false);
      expect(orientationsEqual(a, c, 0.1)).toBe(true); // With tolerance
    });
    
    it('should handle equivalent orientations', () => {
      // These represent the same rotation (identity)
      const a = { x: 0, y: 0, z: 0, w: 1 };
      const b = { x: 0, y: 0, z: 0, w: -1 }; // Negative w is equivalent
      
      expect(orientationsEqual(a, b)).toBe(true);
    });
  });
});
