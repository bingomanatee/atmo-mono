import { v4 as uuidV4 } from 'uuid';
import { PLATE_TYPES } from '../constants';
import {
  PlateIF,
  PlateExtendedIF,
  PlateBehavioralType,
} from '../types.atmo-plates';

/**
 * Calculate the surface area of a sphere
 * @param radius - Radius of the sphere in kilometers
 * @returns Surface area in square kilometers
 */
export function calculateSphereSurfaceArea(radius: number): number {
  return 4 * Math.PI * radius * radius;
}

/**
 * Calculate the volume of a plate
 * @param area - Area of the plate in square kilometers
 * @param thickness - Thickness of the plate in kilometers
 * @returns Volume in cubic kilometers
 */
export function calculatePlateVolume(area: number, thickness: number): number {
  return area * thickness;
}

/**
 * Calculate the mass of a plate
 * @param volume - Volume in cubic kilometers
 * @param density - Density in g/cm³
 * @returns Mass in kilograms
 */
export function calculateMass(volume: number, density: number): number {
  // Convert volume from km³ to m³
  const volumeM3 = volume * 1e9;

  // Convert density from g/cm³ to kg/m³
  const densityKgPerM3 = density * 1000;

  // Calculate mass in kg
  return volumeM3 * densityKgPerM3;
}

/**
 * Determine the behavioral type of a plate based on its density
 * @param density - Density in g/cm³
 * @param densityThreshold1 - Lower threshold for continental plates (default: 2.8)
 * @param densityThreshold2 - Upper threshold for oceanic plates (default: 2.9)
 * @returns Behavioral type of the plate
 */
export function determineBehavioralType(
  density: number,
  densityThreshold1 = 2.8,
  densityThreshold2 = 2.9,
): PlateBehavioralType {
  if (density < densityThreshold1) {
    return PLATE_TYPES.CONTINENTAL;
  } else if (density > densityThreshold2) {
    return PLATE_TYPES.OCEANIC;
  } else {
    return PLATE_TYPES.TRANSITIONAL;
  }
}

/**
 * Calculate the isostatic elevation of a plate segment.
 * @param thicknessKm - Thickness of the plate segment in kilometers.
 * @param density - Density of the plate segment in g/cm³.
 * @param mantleDensity - Density of the mantle in g/cm³ (default: 3.3).
 * @returns Isostatic elevation in kilometers.
 */
export function isostaticElevation(
  thicknessKm: number,
  density: number,
  mantleDensity = 3.3,
): number {
  return thicknessKm * (1 - density / mantleDensity);
}

/**
 * Calculate the floating elevation of a plate segment based on isostasy.
 * @param thicknessKm - Thickness of the plate segment in kilometers.
 * @param density - Density of the plate segment in g/cm³.
 * @param mantleDensity - Density of the mantle in g/cm³ (default: 3.3 g/cm³).
 * @returns Floating elevation in kilometers relative to the surface at mantle density.
 */
export function floatElevation(
  thicknessKm: number,
  density: number,
  mantleDensity = 3.3,
): number {
  return thicknessKm * (1 - density / mantleDensity);
}

/**
 * Extend a basic PlateIF with derived properties to create a PlateExtendedIF
 * @param plate - Basic plate with core properties
 * @param planetRadius - Radius of the planet in kilometers
 * @param rank - Optional rank of the plate (1 = largest)
 * @returns Extended plate with derived properties
 */
export function extendPlate(
  plate: PlateIF & { id?: string },
  planetRadius: number,
  rank?: number,
): PlateExtendedIF {
  // Calculate plate area
  const area = Math.PI * plate.radius * plate.radius;

  // Calculate planet surface area
  const planetSurfaceArea = calculateSphereSurfaceArea(planetRadius);

  // Calculate coverage percentage
  const coveragePercent = (area / planetSurfaceArea) * 100;

  // Calculate volume (area * thickness)
  const volume = calculatePlateVolume(area, plate.thickness);

  // Calculate mass
  const mass = calculateMass(volume, plate.density);

  // Determine behavioral type
  const behavioralType = determineBehavioralType(plate.density);

  // Create extended plate
  return {
    id: plate.id || uuidV4(),
    ...plate,
    area,
    coveragePercent,
    mass,
    rank: rank || 0,
    behavioralType,
  };
}
