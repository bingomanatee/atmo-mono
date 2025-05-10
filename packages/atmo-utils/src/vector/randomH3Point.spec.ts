import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  getRandomH3Cell,
  getRandomTargetCell,
  randomH3Point,
  randomTargetPoint,
} from './randomH3Point.ts';

describe('randomH3Point utilities', () => {
  // Helper function to check if a point is on a sphere
  function isOnSphere(
    point: Vector3,
    radius: number,
    tolerance = 1e-2,
  ): boolean {
    const distance = point.length();
    return Math.abs(distance - radius) / radius < tolerance;
  }

  describe('getRandomH3Cell', () => {
    it('should return a valid H3 cell index', () => {
      const cell = getRandomH3Cell(0);
      expect(cell).toBeTruthy();
      expect(typeof cell).toBe('string');
    });

    it('should return different cells on subsequent calls', () => {
      const cell1 = getRandomH3Cell(1);
      const cell2 = getRandomH3Cell(1);
      expect(cell1).not.toBe(cell2);
    });

    it('should handle different resolutions', () => {
      const cell0 = getRandomH3Cell(0);
      const cell1 = getRandomH3Cell(1);
      const cell3 = getRandomH3Cell(3);

      expect(cell0).toBeTruthy();
      expect(cell1).toBeTruthy();
      expect(cell3).toBeTruthy();
    });
  });

  describe('getRandomTargetCell', () => {
    it('should return a valid H3 cell index', () => {
      const cell = getRandomTargetCell();
      expect(cell).toBeTruthy();
      expect(typeof cell).toBe('string');
    });
  });

  describe('randomH3Point', () => {
    it('should generate a point on the sphere', () => {
      const radius = 6371; // Earth radius in km
      const point = randomH3Point({ radius });

      expect(point).toBeInstanceOf(Vector3);
      expect(isOnSphere(point, radius)).toBe(true);
    });

    it('should generate different points on subsequent calls', () => {
      const radius = 6371;
      const point1 = randomH3Point({ radius });
      const point2 = randomH3Point({ radius });

      expect(point1.distanceTo(point2)).toBeGreaterThan(0);
    });

    it('should respect the variance parameter', () => {
      const radius = 6371;
      const point1 = randomH3Point({ radius, variance: 0 });
      const point2 = randomH3Point({ radius, variance: 500 });

      // Both points should be on the sphere
      expect(isOnSphere(point1, radius)).toBe(true);
      expect(isOnSphere(point2, radius)).toBe(true);
    });
  });

  describe('randomTargetPoint', () => {
    it('should generate a point on the sphere', () => {
      const radius = 6371;
      const point = randomTargetPoint({ radius });

      expect(point).toBeInstanceOf(Vector3);
      expect(isOnSphere(point, radius)).toBe(true);
    });

    it('should generate different points on subsequent calls', () => {
      const radius = 6371;
      const point1 = randomTargetPoint({ radius });
      const point2 = randomTargetPoint({ radius });

      expect(point1.distanceTo(point2)).toBeGreaterThan(0);
    });

    it('should respect the variance parameter', () => {
      const radius = 6371;
      const point1 = randomTargetPoint({ radius, variance: 0 });
      const point2 = randomTargetPoint({ radius, variance: 500 });

      // Both points should be on the sphere
      expect(isOnSphere(point1, radius)).toBe(true);
      expect(isOnSphere(point2, radius)).toBe(true);
    });
  });
});
