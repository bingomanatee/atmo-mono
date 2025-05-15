import { beforeEach, describe, expect, it } from 'vitest';
import { ThreeNode } from './ThreeNode';
import { pointsEqual } from './utils';

describe('ThreeTree', () => {
  let origin: ThreeNode;

  beforeEach(() => {
    origin = new ThreeNode();
  });

  describe('constructor', () => {
    let newNode: ThreeNode;
    beforeEach(() => {
      newNode = new ThreeNode({
        parent: origin,
        position: { x: 100, y: 0, z: 0 },
      });
    });

    it('should have the expected properties', () => {
      expect(
        pointsEqual(newNode.position, { x: 100, y: 0, z: 0 }),
      ).toBeTruthy();
      expect(pointsEqual(newNode.up, { x: 0, y: 1, z: 0 })).toBeTruthy();
    });

    it('should take a new Up', () => {
      const newNodeWithUp = new ThreeNode({
        parent: origin,
        position: { x: 100, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 10 },
      });
      expect(
        pointsEqual(newNodeWithUp.position, { x: 100, y: 0, z: 0 }),
      ).toBeTruthy();
      expect(pointsEqual(newNodeWithUp.up, { x: 0, y: 0, z: 1 })).toBeTruthy();
    });
  });

  describe('reposition', () => {
    let newNode: ThreeNode;
    beforeEach(() => {
      newNode = new ThreeNode({
        parent: origin,
        position: { x: 100, y: 0, z: 0 },
      });
    });

    it('should not change up if repositioning along the same axis', () => {
      newNode.reposition({ x: 200, y: 0, z: 0 });
      expect(
        pointsEqual(newNode.position, { x: 200, y: 0, z: 0 }),
      ).toBeTruthy();
      expect(pointsEqual(newNode.up, { x: 0, y: 1, z: 0 })).toBeTruthy();
    });
    it('should  change up if repositioning', () => {
      console.log('newNode', newNode.position, newNode.up);
      newNode.reposition({ x: 100, y: 100, z: 0 });
      console.log('newNode', newNode.position, newNode.up);
      expect(
        pointsEqual(newNode.position, { x: 100, y: 100, z: 0 }),
      ).toBeTruthy();
      expect(
        pointsEqual(newNode.up, {
          x: -0.7071067811865476,
          y: 0.7071067811865476,
          z: 0,
        }),
      ).toBeTruthy();
    });
  });
});
