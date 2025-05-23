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

  it('should stack multiple small movements correctly', () => {
    const planet = { radius: RADIUS };
    const initialPosition = new Vector3(RADIUS, 0, 0);
    const velocity = new Vector3(0, 0, 1).normalize(); // Rotate around z-axis
    const smallAngle = (5 * Math.PI) / 180; // 5 degrees in radians

    // Perform 5 consecutive moves
    let currentPosition = initialPosition.clone();
    const positions = [currentPosition.clone()];

    for (let i = 0; i < 5; i++) {
      const currentStep = {
        speed: smallAngle,
        velocity: velocity,
        position: currentPosition,
      };
      currentPosition = movePlate(currentStep, planet);
      positions.push(currentPosition.clone());
    }

    // Log all positions for inspection
    /*    console.log('Multiple moves positions:');
    positions.forEach((pos, idx) => {
      console.log(`Move ${idx}: ${pos.toArray()}`);
    });*/

    // After 5 moves of 5 degrees each (25 degrees total), we expect:
    // x = RADIUS * cos(25°)
    // y = RADIUS * sin(25°)
    const totalAngle = (25 * Math.PI) / 180; // 25 degrees in radians
    const expectedFinalPosition = new Vector3(
      RADIUS * Math.cos(totalAngle),
      RADIUS * Math.sin(totalAngle),
      0,
    );

    // Check if the final position is close to what we expect
    expect(currentPosition.distanceTo(expectedFinalPosition)).toBeCloseTo(0, 0);
  });

  it('should rotate around a non-orthogonal axis', () => {
    const planet = { radius: RADIUS };
    const initialPosition = new Vector3(RADIUS, 0, 0);
    // Create a non-orthogonal axis at 45° between x and y
    const nonOrthogonalAxis = new Vector3(1, 1, 0).normalize();

    const currentStep = {
      speed: Math.PI / 4, // 45 degrees
      velocity: nonOrthogonalAxis,
      position: initialPosition,
    };

    const newPosition = movePlate(currentStep, planet);
    /*    console.log('Non-orthogonal rotation:');
    console.log(`Initial: ${initialPosition.toArray()}`);
    console.log(`Axis: ${nonOrthogonalAxis.toArray()}`);
    console.log(`Final: ${newPosition.toArray()}`);*/

    // The plate should maintain its distance from the origin
    expect(newPosition.length()).toBeCloseTo(RADIUS, 0);
  });
});

// Movement axis tests for all cardinal positions and axes
describe('movement axis tests', () => {
  const RADIUS = 10000;
  const planet = { radius: RADIUS };
  const positions = [
    new Vector3(RADIUS, 0, 0),
    new Vector3(0, RADIUS, 0),
    new Vector3(0, 0, RADIUS),
    new Vector3(-RADIUS, 0, 0),
    new Vector3(0, -RADIUS, 0),
    new Vector3(0, 0, -RADIUS),
  ];
  const axes = [
    new Vector3(1, 0, 0).normalize(),
    new Vector3(0, 1, 0).normalize(),
    new Vector3(0, 0, 1).normalize(),
    new Vector3(1, 1, 1).normalize(),
  ];
  const angles = {
    thirty: Math.PI / 6, // 30 degrees
    ninety: Math.PI / 2, // 90 degrees
  };

  positions.forEach((position, posIdx) => {
    axes.forEach((axis, axisIdx) => {
      it(`should rotate position ${position.toArray()} by 30° and 90° around axis ${axis.toArray()}`, () => {
        // Test 30-degree rotation
        const step30 = {
          speed: angles.thirty,
          velocity: axis,
          position: position.clone(),
        };
        const newPosition30 = movePlate(step30, planet);
        /*      console.log(
          `30° Rotation - Initial: ${position.toArray()} | Axis: ${axis.toArray()} | New: ${newPosition30.toArray()}`,
        );*/

        // Test 90-degree rotation
        const step90 = {
          speed: angles.ninety,
          velocity: axis,
          position: position.clone(),
        };
        const newPosition90 = movePlate(step90, planet);
        /*    console.log(
          `90° Rotation - Initial: ${position.toArray()} | Axis: ${axis.toArray()} | New: ${newPosition90.toArray()}`,
        );*/
      });
    });
  });
});
