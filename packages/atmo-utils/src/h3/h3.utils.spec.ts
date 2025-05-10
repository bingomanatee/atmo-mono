import * as h3Utils from './h3.utils.ts';

describe('H3 Utilities', () => {
  const EARTH_RADIUS = 6371008.8; // meters

  describe('h3HexRadiusAtResolution', () => {
    it('should calculate correct radius for Earth at resolution 0', () => {
      const radius = h3Utils.h3HexRadiusAtResolution(EARTH_RADIUS, 0);
      expect(radius).toBeCloseTo(1077580, 0); // res0CellRadiusOnEarth
    });

    it('should scale correctly with resolution', () => {
      const radius0 = h3Utils.h3HexRadiusAtResolution(EARTH_RADIUS, 0);
      const radius1 = h3Utils.h3HexRadiusAtResolution(EARTH_RADIUS, 1);
      // Should scale by ~1/2.64 per resolution
      expect(radius1).toBeCloseTo(radius0 / 2.64, 0);
    });

    it('should scale with planet radius', () => {
      const marsRadius = 3389500; // meters
      const earthRadius = h3Utils.h3HexRadiusAtResolution(EARTH_RADIUS, 0);
      const marsHexRadius0 = h3Utils.h3HexRadiusAtResolution(marsRadius, 0);
      expect(marsHexRadius0).toBeCloseTo(
        earthRadius * (marsRadius / EARTH_RADIUS),
        0,
      );
    });

    it('should throw error for invalid resolution levels', () => {
      expect(() => h3Utils.h3HexRadiusAtResolution(EARTH_RADIUS, -1)).toThrow();
      expect(() => h3Utils.h3HexRadiusAtResolution(EARTH_RADIUS, 16)).toThrow();
    });
  });

  describe('h3HexArea', () => {
    it('should calculate correct area for Earth at resolution 0', () => {
      const area = h3Utils.h3HexArea(0, EARTH_RADIUS);
      // Area should be approximately 4.25e8 m² at resolution 0
      expect(area).toBeGreaterThan(4e8);
      expect(area).toBeLessThan(5e8);
    });

    it('should scale area by approximately 1/7 per resolution level', () => {
      const area0 = h3Utils.h3HexArea(0, EARTH_RADIUS);
      const area1 = h3Utils.h3HexArea(1, EARTH_RADIUS);
      const ratio = area0 / area1;
      expect(ratio).toBeCloseTo(7, 0);
    });

    it('should throw error for invalid resolution levels', () => {
      expect(() => h3Utils.h3HexArea(-1, EARTH_RADIUS)).toThrow();
      expect(() => h3Utils.h3HexArea(16, EARTH_RADIUS)).toThrow();
    });
  });

  describe('latLngToCell and cellToLatLng', () => {
    it('should convert between lat/lng and H3 cell index', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const resolution = 9;

      const h3Index = h3Utils.latLngToCell(lat, lng, resolution);
      expect(h3Utils.isValidCell(h3Index)).toBe(true);

      const { lat: resultLat, lng: resultLng } = h3Utils.cellToLatLng(h3Index);
      // Should be close to original coordinates (within ~0.001 degrees at res 9)
      expect(resultLat).toBeCloseTo(lat, 1);
      expect(resultLng).toBeCloseTo(lng, 1);
    });
  });

  describe('getResolution', () => {
    it('should return the correct resolution of an H3 cell index', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const resolution = 9;

      const h3Index = h3Utils.latLngToCell(lat, lng, resolution);
      expect(h3Utils.getResolution(h3Index)).toBe(resolution);
    });
  });

  describe('getNeighbors', () => {
    it('should return the correct number of neighbors', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const resolution = 9;

      const h3Index = h3Utils.latLngToCell(lat, lng, resolution);
      const neighbors = h3Utils.getNeighbors(h3Index);

      // A hexagon should have 6 neighbors
      expect(neighbors.length).toBe(6);

      // All neighbors should be valid H3 cell indices
      neighbors.forEach((neighbor) => {
        expect(h3Utils.isValidCell(neighbor)).toBe(true);
      });
    });
  });

  describe('cellToBoundary', () => {
    it('should return the correct number of vertices', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const resolution = 9;

      const h3Index = h3Utils.latLngToCell(lat, lng, resolution);
      const boundary = h3Utils.cellToBoundary(h3Index);

      // A hexagon should have 6 vertices (plus the first one repeated at the end to close the loop)
      expect(boundary.length).toBe(6);
    });
  });

  describe('parent-child relationships', () => {
    it('should correctly identify parent-child relationships', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const childRes = 9;
      const parentRes = 8;

      const childIndex = h3Utils.latLngToCell(lat, lng, childRes);
      const parentIndex = h3Utils.cellToParent(childIndex, parentRes);

      expect(h3Utils.getResolution(parentIndex)).toBe(parentRes);

      const children = h3Utils.cellToChildren(parentIndex, childRes);
      expect(children).toContain(childIndex);
    });
  });
});
