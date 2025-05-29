import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

// Helper function to round coordinates for easier testing
function roundVector(vector: Vector3): Vector3 {
  return new Vector3(
    Math.round(vector.x),
    Math.round(vector.y),
    Math.round(vector.z),
  );
}

// Helper to create a normalized position vector
function createPositionVector(
  x: number,
  y: number,
  z: number,
  radius: number,
): Vector3 {
  let vector = new Vector3(x, y, z);

  // If the vector is zero or very close to zero, use a default direction (along x-axis)
  if (vector.lengthSq() < 0.0001) {
    vector = new Vector3(1, 0, 0);
  } else {
    vector.normalize();
  }

  return vector.multiplyScalar(radius);
}

describe('plateMovement helpers', () => {
  describe('roundVector', () => {
    it('should round all components to integers', () => {
      const vector = new Vector3(10000.7, 5000.3, 2500.9);
      const rounded = roundVector(vector);

      expect(rounded.x).toBe(10001);
      expect(rounded.y).toBe(5000);
      expect(rounded.z).toBe(2501);
    });

    it('should handle negative values', () => {
      const vector = new Vector3(-10000.7, -5000.3, -2500.9);
      const rounded = roundVector(vector);

      expect(rounded.x).toBe(-10001);
      expect(rounded.y).toBe(-5000);
      expect(rounded.z).toBe(-2501);
    });

    it('should handle zero values', () => {
      const vector = new Vector3(0, 0, 0);
      const rounded = roundVector(vector);

      expect(rounded.x).toBe(0);
      expect(rounded.y).toBe(0);
      expect(rounded.z).toBe(0);
    });
  });

  describe('createPositionVector', () => {
    it('should create a normalized vector at the specified radius', () => {
      const radius = 10000;
      const vector = createPositionVector(1, 0, 0, radius);

      expect(vector.length()).toBeCloseTo(radius);
      expect(vector.x).toBeCloseTo(radius);
      expect(vector.y).toBeCloseTo(0);
      expect(vector.z).toBeCloseTo(0);
    });

    it('should normalize input coordinates before scaling', () => {
      const radius = 10000;
      const vector = createPositionVector(2, 2, 0, radius);

      expect(vector.length()).toBeCloseTo(radius);
      // Should be normalized to (1/√2, 1/√2, 0) then scaled
      expect(vector.x).toBeCloseTo(radius / Math.sqrt(2));
      expect(vector.y).toBeCloseTo(radius / Math.sqrt(2));
      expect(vector.z).toBeCloseTo(0);
    });

    it('should handle zero input by using default direction', () => {
      const radius = 10000;
      const vector = createPositionVector(0, 0, 0, radius);

      // Should default to a unit vector along x-axis
      expect(vector.length()).toBeCloseTo(radius);
      expect(vector.x).toBeCloseTo(radius);
      expect(vector.y).toBeCloseTo(0);
      expect(vector.z).toBeCloseTo(0);
    });

    it('should handle very small input by using default direction', () => {
      const radius = 10000;
      const vector = createPositionVector(0.0001, 0.0001, 0.0001, radius);

      // Should default to a unit vector along x-axis
      expect(vector.length()).toBeCloseTo(radius);
      expect(vector.x).toBeCloseTo(radius);
      expect(vector.y).toBeCloseTo(0);
      expect(vector.z).toBeCloseTo(0);
    });

    it('should create vectors at different angles', () => {
      const radius = 10000;
      const testCases = [
        { input: [1, 0, 0], expected: [radius, 0, 0] },
        { input: [0, 1, 0], expected: [0, radius, 0] },
        { input: [0, 0, 1], expected: [0, 0, radius] },
        {
          input: [1, 1, 0],
          expected: [radius / Math.sqrt(2), radius / Math.sqrt(2), 0],
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const vector = createPositionVector(
          input[0],
          input[1],
          input[2],
          radius,
        );
        expect(vector.x).toBeCloseTo(expected[0]);
        expect(vector.y).toBeCloseTo(expected[1]);
        expect(vector.z).toBeCloseTo(expected[2]);
      });
    });
  });
});
