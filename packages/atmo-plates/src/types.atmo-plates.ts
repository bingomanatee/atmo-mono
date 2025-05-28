import type { Vector3Like } from 'three';
import { PLATE_TYPES } from './constants';

// Type for the PLATE_TYPES object itself
export type PlateTypesMap = typeof PLATE_TYPES;

// Type for the values in PLATE_TYPES
export type PlateTypeValue = PlateTypesMap[keyof PlateTypesMap];

// Alias for backward compatibility
export type PlateBehavioralType = PlateTypeValue;

// Interface for objects with a unique identifier
export interface Identifiable {
  id: string; // Unique identifier
}

// Basic plate interface with core physical properties
export interface PlateIF {
  radius: number; // kilometers
  density: number; // g/cm³
  thickness: number; // kilometers
}

export interface PlanetLocal {
  name: string;
  radius: number;
}

// Derived plate properties calculated from core properties
export interface PlateDerivedPropertiesIF {
  area: number; // km²
  coveragePercent: number; // % of planet surface
  mass: number; // kg
  rank: number; // 1 = largest
  behavioralType: PlateBehavioralType; // continental-like, oceanic-like, transitional
}

// Summary statistics for a plate distribution
export interface PlateDistributionSummary {
  totalPlates: number; // count
  totalCoverage: number; // % of surface
  planetSurfaceArea: number; // km²
  continentalLikePlates: number; // count
  oceanicLikePlates: number; // count
  transitionalPlates: number; // count
  continentalLikeCoverage: number; // %
  oceanicLikeCoverage: number; // %
  transitionalCoverage: number; // %
}

// Extended plate interface with derived properties
export interface PlateExtendedIF extends PlateIF, PlateDerivedPropertiesIF {}

// Complete manifest of generated plates
export interface PlateManifest {
  config: PlateGeneratorConfig;
  plates: PlateExtendedIF[];
  summary: PlateDistributionSummary;
}

// Configuration for plate generation
export interface PlateGeneratorConfig {
  planetRadius: number; // km
  plateCount: number; // count
  targetCoverage?: number; // 0-1 fraction
  powerLawExponent?: number; // higher = more skewed distribution
  minDensity?: number; // g/cm³, lower bound
  maxDensity?: number; // g/cm³, upper bound
  minThickness?: number; // km, lower bound
  maxThickness?: number; // km, upper bound
  variationFactor?: number; // 0-1 random variation
  maxPlateRadius?: number; // Add maxPlateRadius in radians
}

// Extended plate interface with simulation-specific properties
export interface PlateSimExtendedIF extends PlateExtendedIF, Identifiable {
  name?: string; // display name
  planetId: string; // planet reference
  position: Vector3Like; // 3D position
}

// Simulation record type
export type SimSimulation = {
  id: string; // unique identifier
  name: string; // display name
  planetId: string; // planet reference
  plateCount: number; // number of plates to generate
};

// Basic planet interface with core physical properties
export interface PlanetIF {
  radius: number; // kilometers
  name?: string; // optional display name
}

// Extended planet interface with simulation-specific properties
export interface SimPlanetIF extends PlanetIF, Identifiable {
  name?: string; // display name
}
