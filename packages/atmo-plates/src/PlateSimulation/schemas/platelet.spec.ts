import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Platelet, createPlatelet } from './platelet';

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
    expect(platelet.radius).toBe(1.0);
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
      radius: 5.0,
    });

    expect(platelet.mass).toBe(2.0);
    expect(platelet.elasticity).toBe(0.8);
    expect(platelet.velocity).toEqual(velocity);
    expect(platelet.isActive).toBe(false);
    expect(platelet.temperature).toBe(100);
  });
});
