import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { movePlate } from './plateMovement';

// Tests for the movePlate function, which simulates plate movement on a planet's surface

describe('plateMovement', () => {
  const RADIUS = 10000;

  it('should maintain plate position when velocity is zero', () => {
    // Plate starts at (RADIUS, 0, 0) and does not move because speed is zero
    const planet = { radius: RADIUS };
    const initialPosition = new Vector3(RADIUS, 0, 0);
    const currentStep = {
      speed: 0,
      velocity: new Vector3(0, 0, 1).normalize(), // Axis of rotation (irrelevant here)
      position: initialPosition,
    };

    const newPosition = movePlate(currentStep, planet);
    // The plate should not move at all
    expect(newPosition.distanceTo(initialPosition)).toBeCloseTo(0, 5);
  });

  it('should rotate plate by 45 degrees when velocity is Math.PI/4', () => {
    // Plate starts at (RADIUS, 0, 0) and should rotate 45 degrees CCW around the z-axis
    const planet = { radius: RADIUS };
    const initialPosition = new Vector3(RADIUS, 0, 0);
    const currentStep = {
      speed: Math.PI / 4, // 45 degrees in radians
      velocity: new Vector3(0, 0, 1).normalize(), // Rotate around z-axis
      position: initialPosition,
    };

    const newPosition = movePlate(currentStep, planet);
    // After 45 degree rotation, expected position is (RADIUS/sqrt(2), RADIUS/sqrt(2), 0)
    const expectedPosition = new Vector3(RADIUS * 0.7071, RADIUS * 0.7071, 0);
    expect(newPosition.distanceTo(expectedPosition)).toBeCloseTo(0, 0); // Acceptable error < 1 unit
  });
});
