import { describe, expect, it } from 'vitest';
import { PLATE_TYPES } from '../constants';
import {
  calculateSphereSurfaceArea,
  calculatePlateVolume,
  calculateMass,
  determineBehavioralType,
  extendPlate,
} from './plateUtils';
import { type PlateIF } from '../types.atmo-plates';

describe('plateUtils', () => {
  describe('calculateSphereSurfaceArea', () => {
    it('should calculate the surface area of a sphere correctly', () => {
      // Earth radius in km
      const radius = 6371;
      const expectedArea = 4 * Math.PI * radius * radius;

      expect(calculateSphereSurfaceArea(radius)).toBe(expectedArea);
    });

    it('should handle zero radius', () => {
      expect(calculateSphereSurfaceArea(0)).toBe(0);
    });
  });

  describe('calculatePlateVolume', () => {
    it('should calculate the volume of a plate correctly', () => {
      const area = 1000; // km²
      const thickness = 10; // km
      const expectedVolume = area * thickness; // km³

      expect(calculatePlateVolume(area, thickness)).toBe(expectedVolume);
    });

    it('should handle zero area or thickness', () => {
      expect(calculatePlateVolume(0, 10)).toBe(0);
      expect(calculatePlateVolume(1000, 0)).toBe(0);
    });
  });

  describe('calculateMass', () => {
    it('should calculate the mass of a plate correctly', () => {
      const volume = 10000; // km³
      const density = 2.7; // g/cm³

      // Convert volume from km³ to m³
      const volumeM3 = volume * 1e9;

      // Convert density from g/cm³ to kg/m³
      const densityKgPerM3 = density * 1000;

      // Calculate expected mass in kg
      const expectedMass = volumeM3 * densityKgPerM3;

      expect(calculateMass(volume, density)).toBe(expectedMass);
    });
  });

  describe('determineBehavioralType', () => {
    it('should determine continental-like plates correctly', () => {
      expect(determineBehavioralType(2.7, 2.8, 2.9)).toBe(
        PLATE_TYPES.CONTINENTAL,
      );
    });

    it('should determine oceanic-like plates correctly', () => {
      expect(determineBehavioralType(3.0, 2.8, 2.9)).toBe(PLATE_TYPES.OCEANIC);
    });

    it('should determine transitional plates correctly', () => {
      expect(determineBehavioralType(2.85, 2.8, 2.9)).toBe(
        PLATE_TYPES.TRANSITIONAL,
      );
    });

    it('should use default thresholds if not provided', () => {
      // Default thresholds are 2.8 and 2.9
      expect(determineBehavioralType(2.7)).toBe(PLATE_TYPES.CONTINENTAL);
      expect(determineBehavioralType(3.0)).toBe(PLATE_TYPES.OCEANIC);
      expect(determineBehavioralType(2.85)).toBe(PLATE_TYPES.TRANSITIONAL);
    });
  });

  describe('extendPlate', () => {
    it('should extend a basic plate with derived properties', () => {
      const basicPlate: PlateIF & { id?: string } = {
        id: 'test-plate',
        radius: 1000,
        density: 2.7,
        thickness: 30,
      };

      const planetRadius = 6371; // Earth radius in km
      const rank = 1;

      const extendedPlate = extendPlate(basicPlate, planetRadius, rank);

      // Calculate expected values
      const area = Math.PI * basicPlate.radius * basicPlate.radius;
      const planetSurfaceArea = calculateSphereSurfaceArea(planetRadius);
      const coveragePercent = (area / planetSurfaceArea) * 100;
      const volume = calculatePlateVolume(area, basicPlate.thickness);
      const mass = calculateMass(volume, basicPlate.density);

      // Verify all properties
      expect(extendedPlate.id).toBe(basicPlate.id);
      expect(extendedPlate.radius).toBe(basicPlate.radius);
      expect(extendedPlate.density).toBe(basicPlate.density);
      expect(extendedPlate.thickness).toBe(basicPlate.thickness);
      expect(extendedPlate.area).toBe(area);
      expect(extendedPlate.coveragePercent).toBe(coveragePercent);
      expect(extendedPlate.mass).toBe(mass);
      expect(extendedPlate.rank).toBe(rank);
      expect(extendedPlate.behavioralType).toBe(PLATE_TYPES.CONTINENTAL);
    });

    it('should generate an id if not provided', () => {
      const basicPlate: PlateIF = {
        radius: 1000,
        density: 2.7,
        thickness: 30,
      };

      const extendedPlate = extendPlate(basicPlate, 6371);

      expect(extendedPlate.id).toBeDefined();
      expect(typeof extendedPlate.id).toBe('string');
    });

    it('should use default rank if not provided', () => {
      const basicPlate: PlateIF & { id: string } = {
        id: 'test-plate',
        radius: 1000,
        density: 2.7,
        thickness: 30,
      };

      const extendedPlate = extendPlate(basicPlate, 6371);

      expect(extendedPlate.rank).toBe(0);
    });
  });
});
