import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Platelet, createPlatelet, subdividePlate } from './platelet';

describe('platelet', () => {
  it('should create a platelet with default values', () => {
    const plateId = 'test-plate';
    const position = new Vector3(1, 2, 3);
    const platelet = createPlatelet(plateId, position);

    expect(platelet.id).toBeDefined();
    expect(platelet.plateId).toBe(plateId);
    expect(platelet.position).toEqual(position);
    expect(platelet.mass).toBe(1.0);
    expect(platelet.elasticity).toBe(0.5);
    expect(platelet.velocity).toEqual(new Vector3());
    expect(platelet.isActive).toBe(true);
  });

  it('should create a platelet with custom values', () => {
    const plateId = 'test-plate';
    const position = new Vector3(1, 2, 3);
    const velocity = new Vector3(4, 5, 6);
    const platelet = createPlatelet(plateId, position, {
      mass: 2.0,
      elasticity: 0.8,
      velocity,
      isActive: false,
      temperature: 100,
    });

    expect(platelet.mass).toBe(2.0);
    expect(platelet.elasticity).toBe(0.8);
    expect(platelet.velocity).toEqual(velocity);
    expect(platelet.isActive).toBe(false);
    expect(platelet.temperature).toBe(100);
  });

  it('should subdivide a plate into platelets', () => {
    const plateId = 'test-plate';
    const center = new Vector3(0, 0, 0);
    const radius = 10;
    const subdivisions = 4;

    const platelets = subdividePlate(plateId, center, radius, subdivisions);

    expect(platelets).toHaveLength(subdivisions);

    // Check that platelets form a circle
    platelets.forEach((platelet, index) => {
      const angle = (2 * Math.PI * index) / subdivisions;
      const expectedX = center.x + radius * Math.cos(angle);
      const expectedY = center.y + radius * Math.sin(angle);
      const expectedZ = center.z;

      expect(platelet.position.x).toBeCloseTo(expectedX);
      expect(platelet.position.y).toBeCloseTo(expectedY);
      expect(platelet.position.z).toBe(expectedZ);
      expect(platelet.plateId).toBe(plateId);
    });
  });
});
