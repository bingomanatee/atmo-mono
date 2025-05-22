import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { ThreeOrbitalFrame } from './ThreeOrbitalFrame';

describe('ThreeOrbitalFrame', () => {
  it('should rotate an object by 30 degrees around the z-axis', () => {
    const radius = 1000;
    // Create a frame at origin with z-axis rotation
    const frame = new ThreeOrbitalFrame({
      axis: new Vector3(0, 0, 1),
      velocity: (Math.PI / 6) * radius, // 30 degrees in radians * radius
      radius,
    });

    // Create an object at (1000, 0, 0) in the frame's local space
    const obj = new Object3D();
    obj.position.set(radius, 0, 0);
    frame.add(obj);

    // Rotate the frame
    frame.orbit();

    // Get the new global position
    const newPosition = obj.position.clone();
    frame.localToWorld(newPosition);
    console.log('new position is ', newPosition);

    // After 30 degrees rotation around z-axis, we expect:
    // x = 1000 * cos(30°) ≈ 866
    // y = 1000 * sin(30°) = 500
    // z = 0
    expect(newPosition.x).toBeCloseTo(866, 0);
    expect(newPosition.y).toBeCloseTo(500, 0);
    expect(newPosition.z).toBeCloseTo(0, 0);
  });
});
