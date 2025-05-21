import { v4 as uuidV4 } from 'uuid';
import {
  PlateIF,
  PlateExtendedIF,
  PLATE_TYPES,
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
 * Calculate the volume of a spherical shell
 * @param radius - Outer radius of the shell in kilometers
 * @param thickness - Thickness of the shell in kilometers
 * @returns Volume in cubic kilometers
 */
export function calculateSphericalShellVolume(
  radius: number,
  thickness: number
): number {
  const innerRadius = radius - thickness;
  return (4 / 3) * Math.PI * (Math.pow(radius, 3) - Math.pow(innerRadius, 3));
}

/**
 * Convert cubic kilometers to cubic centimeters
 * @param volumeKm3 - Volume in cubic kilometers
 * @returns Volume in cubic centimeters
 */
export function km3ToCm3(volumeKm3: number): number {
  return volumeKm3 * 1e15; // 1 km³ = 10^15 cm³
}

/**
 * Calculate the mass of a plate
 * @param volume - Volume in cubic kilometers
 * @param density - Density in g/cm³
 * @returns Mass in kilograms
 */
export function calculateMass(volume: number, density: number): number {
  const volumeCm3 = km3ToCm3(volume);
  return volumeCm3 * density; // g to kg conversion is 1:1000, but we're using g/cm³, so it's already in kg
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
  densityThreshold2 = 2.9
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
 * Extend a basic PlateIF with derived properties to create a PlateExtendedIF
 * @param plate - Basic plate with core properties
 * @param planetRadius - Radius of the planet in kilometers
 * @param rank - Optional rank of the plate (1 = largest)
 * @returns Extended plate with derived properties
 */
export function extendPlate(
  plate: PlateIF & { id?: string },
  planetRadius: number,
  rank?: number
): PlateExtendedIF {
  // Calculate plate area
  const area = Math.PI * plate.radius * plate.radius;
  
  // Calculate planet surface area
  const planetSurfaceArea = calculateSphereSurfaceArea(planetRadius);
  
  // Calculate coverage percentage
  const coveragePercent = (area / planetSurfaceArea) * 100;
  
  // Calculate volume
  const volume = calculateSphericalShellVolume(plate.radius, plate.thickness);
  
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
