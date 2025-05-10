import { describe, expect, it } from 'vitest';
import { h3HexRadiusAtResolution } from './hexRadius.ts';
import { h3HexArea } from './h3HexArea.ts';

describe('H3 Utilities', () => {
  const EARTH_RADIUS = 6371008.8; // meters

  describe('h3HexRadiusAtResolution', () => {
    it('should calculate correct radius for Earth at resolution 0', () => {
      const radius = h3HexRadiusAtResolution(EARTH_RADIUS, 0);
      expect(radius).toBeCloseTo(1077580, 0); // level0hexRadiusOnEarth
    });

    it('should scale correctly with resolution', () => {
      const radius0 = h3HexRadiusAtResolution(EARTH_RADIUS, 0);
      const radius1 = h3HexRadiusAtResolution(EARTH_RADIUS, 1);
      // Should scale by ~1/2.64 per level
      expect(radius1).toBeCloseTo(radius0 / 2.64, 0);
    });

    it('should scale with planet radius', () => {
      const marsRadius = 3389500; // meters
      const earthRadius = h3HexRadiusAtResolution(EARTH_RADIUS, 0);
      const marHexRadius0 = h3HexRadiusAtResolution(marsRadius, 0);
      expect(marHexRadius0).toBeCloseTo(
        earthRadius * (marsRadius / EARTH_RADIUS),
        0,
      );
    });
  });

  describe('h3HexArea', () => {
    it('should calculate correct area for Earth at resolution 0', () => {
      const area = h3HexArea(0, EARTH_RADIUS);
      // Area should be approximately 4.25e8 m² at level 0
      expect(area).toBeGreaterThan(4e8);
      expect(area).toBeLessThan(5e8);
    });

    it('should scale area by approximately 1/7 per resolution level', () => {
      const area0 = h3HexArea(0, EARTH_RADIUS);
      const area1 = h3HexArea(1, EARTH_RADIUS);
      const ratio = area0 / area1;
      expect(ratio).toBeCloseTo(7, 0);
    });

    it('should throw error for invalid resolution levels', () => {
      expect(() => h3HexArea(-1, EARTH_RADIUS)).toThrow();
      expect(() => h3HexArea(16, EARTH_RADIUS)).toThrow();
    });
  });
});
