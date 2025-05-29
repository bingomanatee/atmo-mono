/**
 * Generates plates following a Max Power distribution with a spectrum of properties
 * where size correlates with density and other physical characteristics.
 *
 * Instead of discrete "continental" and "oceanic" categories, plates exist on a spectrum
 * where larger plates tend to be less dense (behaving like continental plates) and
 * smaller plates tend to be more dense (behaving like oceanic plates).
 */

import { varyP } from '@wonderlandlabs/atmo-utils';
import {
  PlateGeneratorConfig,
  PlateManifest,
  PlateExtendedIF,
  Identifiable,
} from '../types.atmo-plates';
import {
  calculateSphereSurfaceArea,
  calculatePlateVolume,
  calculateMass,
  determineBehavioralType,
} from '../utils/plateUtils';
import { v4 as uuidV4 } from 'uuid';

export class PlateSpectrumGenerator {
  private config: Required<
    Omit<
      PlateGeneratorConfig,
      | 'simulationSteps'
      | 'repulsionStrength'
      | 'attractionStrength'
      | 'densityTolerance'
      | 'deltaTime'
    >
  >;
  private planetSurfaceArea: number;
  private readonly planetRadius: number;
  private readonly plateCount: number;
  private readonly maxPlateRadius?: number;

  /**
   * @param config - Configuration options for plate generation
   */
  constructor(config: PlateGeneratorConfig) {
    this.config = {
      ...config,
      targetCoverage: config.targetCoverage ?? 0.7, // Reduced default coverage to 70%
      powerLawExponent: config.powerLawExponent ?? 3.0, // Increased default power law exponent
      minDensity: config.minDensity ?? 2.6, // g/cm³ (typical continental crust)
      maxDensity: config.maxDensity ?? 3.3, // g/cm³ (typical oceanic crust)
      minThickness: config.minThickness ?? 7, // km (typical oceanic crust)
      maxThickness: config.maxThickness ?? 35, // km (typical continental crust)
      variationFactor: config.variationFactor ?? 0.2,
      maxPlateRadius: config.maxPlateRadius ?? Math.PI / 6, // Default to PI/6 if not provided
    };

    this.planetSurfaceArea = calculateSphereSurfaceArea(config.planetRadius);
    this.planetRadius = config.planetRadius;
    this.plateCount = config.plateCount;
    this.maxPlateRadius = config.maxPlateRadius;
  }

  // Static convenience method to generate plates without creating an instance
  public static generatePlates(config: PlateGeneratorConfig): PlateManifest {
    const generator = new PlateSpectrumGenerator(config);
    return generator.generate();
  }
  public generate(): PlateManifest {
    let plates = this.generatePlates(); // Initial generation

    // --- Post-processing: Enforce maximum plate radius ---
    // Convert max allowed radius from radians to a linear distance on the planet surface
    const maxAllowedLinearRadius =
      (this.config.maxPlateRadius ?? Math.PI / 6) * this.config.planetRadius;
    console.log(
      `Enforcing maximum plate radius: ${maxAllowedLinearRadius} km (from ${this.config.maxPlateRadius ?? Math.PI / 6} radians)`,
    ); // Log the maximum enforced radius

    plates.forEach((plate) => {
      if (plate.radius > maxAllowedLinearRadius) {
        console.log(
          `Capping plate ${plate.id} radius from ${plate.radius} to ${maxAllowedLinearRadius}`,
        );
        plate.radius = maxAllowedLinearRadius;

        // Recalculate dependent properties based on new radius
        plate.area = Math.PI * Math.pow(plate.radius, 2);
        // Assuming thickness doesn't change, recalculate volume and mass
        // Volume = Area * Thickness (simplified, assuming flat disk for calculation)
        plate.volume = plate.area * (plate.thickness * 1000); // Convert thickness from km to meters for volume/mass calc
        plate.mass = plate.volume * (plate.density * 1000); // Convert density from g/cm³ to kg/m³ (1 g/cm³ = 1000 kg/m³)

        // Note: Behavioral type is based on density, which we are not changing here.
        // If density/thickness were recalculated based on new size, behavioral type might change.
        // For now, we keep original density/thickness and recalculate area/volume/mass based on capped radius.
      }
    });
    // --- End post-processing ---

    const continentalLikePlates = plates.filter(
      (p) => p.behavioralType === 'continental-like',
    );
    const oceanicLikePlates = plates.filter(
      (p) => p.behavioralType === 'oceanic-like',
    );
    const transitionalPlates = plates.filter(
      (p) => p.behavioralType === 'transitional',
    );

    // Recalculate total coverage based on potentially capped areas
    const totalCappedCoverageArea = plates.reduce(
      (sum, plate) => sum + plate.area,
      0,
    );
    const totalCappedCoveragePercent =
      (totalCappedCoverageArea / this.planetSurfaceArea) * 100;

    const continentalLikeCoverage = continentalLikePlates.reduce(
      (sum, plate) => sum + plate.coveragePercent, // Using original coveragePercent might be misleading
      0,
    );

    const oceanicLikeCoverage = oceanicLikePlates.reduce(
      (sum, plate) => sum + plate.coveragePercent, // Using original coveragePercent might be misleading
      0,
    );

    const transitionalCoverage = transitionalPlates.reduce(
      (sum, plate) => sum + plate.coveragePercent, // Using original coveragePercent might be misleading
      0,
    );

    // Note: The individual plate.coveragePercent values are based on the original distribution.
    // The totalCoverage in the summary should ideally reflect the capped total area.

    return {
      config: this.config,
      plates,
      summary: {
        totalPlates: plates.length,
        // Use the capped total coverage percentage
        totalCoverage: totalCappedCoveragePercent,
        planetSurfaceArea: this.planetSurfaceArea,
        continentalLikePlates: continentalLikePlates.length,
        oceanicLikePlates: oceanicLikePlates.length,
        transitionalPlates: transitionalPlates.length,
        continentalLikeCoverage,
        oceanicLikeCoverage,
        transitionalCoverage,
      },
    };
  }

  private generatePlates(): PlateExtendedIF[] {
    const {
      plateCount,
      targetCoverage,
      powerLawExponent,
      minDensity,
      maxDensity,
      minThickness,
      maxThickness,
    } = this.config;

    const targetArea = this.planetSurfaceArea * targetCoverage;
    const rawSizes = this.generatePowerLawSizes(plateCount, powerLawExponent);

    const sum = rawSizes.reduce((a, b) => a + b, 0);
    const normalizedSizes = rawSizes.map((size) => size / sum);

    return normalizedSizes.map((fraction, index) => {
      const rank = index + 1;
      const area = targetArea * fraction;

      // Calculate radius: A = πr², so r = √(A/π)
      const radius = Math.sqrt(area / Math.PI);

      // Calculate normalized rank (0-1) for property interpolation
      const normalizedRank = (rank - 1) / (plateCount - 1);

      // Smaller plates (higher rank) have higher density and lower thickness
      // For thickness, we reverse min/max because smaller plates have lower thickness
      const density = this.interpolateProperty(
        minDensity,
        maxDensity,
        normalizedRank,
      );
      const thickness = this.interpolateProperty(
        maxThickness,
        minThickness,
        normalizedRank,
      );

      // Calculate volume and mass using utility functions
      const volume = calculatePlateVolume(area, thickness);
      const mass = calculateMass(volume, density);

      // Determine behavioral type based on density thresholds
      const densityRange = maxDensity - minDensity;
      const densityThreshold1 = minDensity + densityRange * 0.33;
      const densityThreshold2 = minDensity + densityRange * 0.66;

      // Determine behavioral type using utility function
      const behavioralType = determineBehavioralType(
        density,
        densityThreshold1,
        densityThreshold2,
      );

      return {
        id: `plate-${rank}`,
        radius,
        area,
        coveragePercent: fraction * 100 * targetCoverage,
        density,
        thickness,
        mass,
        rank,
        behavioralType,
      };
    });
  }

  /**
   * Generate raw power law distribution values
   *
   * @param count - Number of values to generate
   * @param exponent - Power law exponent (higher = more skewed)
   * @returns Array of values following a power law distribution
   */
  private generatePowerLawSizes(count: number, exponent: number): number[] {
    // Apply power law formula: size ∝ 1/rank^exponent
    return Array.from({ length: count }, (_, i) => Math.pow(i + 1, -exponent));
  }

  /**
   * @param min - Minimum value
   * @param max - Maximum value
   * @param lerp - Linear interpolation factor (0-1)
   * @returns Interpolated value with natural variation
   */
  private interpolateProperty(min: number, max: number, lerp: number): number {
    return varyP({
      min,
      max,
      pct: this.config.variationFactor,
      lerp,
    });
  }

  /**
   * Generate a single plate with optional preset values
   * @param preset - Partial plate properties to override generated values
   * @returns A single generated plate with preset values applied where specified
   */
  public generateOne(preset: Partial<PlateExtendedIF>): PlateExtendedIF {
    const { minDensity, maxDensity, minThickness, maxThickness } = this.config;

    // Always calculate radius first, then derive area
    let radius: number;
    if (preset.radius !== undefined) {
      radius = preset.radius;
    } else {
      // Generate a random size if radius not provided
      const targetArea = this.planetSurfaceArea * this.config.targetCoverage;
      // Generate a random rank between 1 and 100 for the power law distribution
      const randomRank = Math.floor(Math.random() * 100) + 1;
      const rawSize = Math.pow(randomRank, -this.config.powerLawExponent);
      // Normalize against the sum of a typical distribution
      const normalizedSize = rawSize / 2.5; // Approximate normalization factor for power law
      const area = targetArea * normalizedSize;
      radius = Math.sqrt(area / Math.PI);
    }

    // Calculate area from radius: A = πr²
    const area = Math.PI * radius * radius;

    // Use preset values if provided, otherwise generate them
    const density =
      preset.density ??
      this.interpolateProperty(
        minDensity,
        maxDensity,
        Math.random(), // Random rank for single plate
      );

    const thickness =
      preset.thickness ??
      this.interpolateProperty(
        maxThickness,
        minThickness,
        Math.random(), // Random rank for single plate
      );

    // Calculate volume and mass using utility functions
    const volume = calculatePlateVolume(area, thickness);
    const mass = calculateMass(volume, density);

    // Determine behavioral type based on density thresholds
    const densityRange = maxDensity - minDensity;
    const densityThreshold1 = minDensity + densityRange * 0.33;
    const densityThreshold2 = minDensity + densityRange * 0.66;

    // Determine behavioral type using utility function
    const behavioralType = determineBehavioralType(
      density,
      densityThreshold1,
      densityThreshold2,
    );

    // Calculate coverage percentage
    const coveragePercent =
      (area / this.planetSurfaceArea) * 100 * this.config.targetCoverage;

    return {
      id: preset.id ?? `plate-${Math.floor(Math.random() * 10000)}`,
      radius,
      area,
      coveragePercent,
      density,
      thickness,
      mass,
      rank: preset.rank ?? 0,
      behavioralType,
    };
  }

  /**
   * Generate plates with evenly distributed radii between specified bounds
   * @param options - Configuration options for plate generation
   * @param options.planetRadius - Radius of the planet in kilometers
   * @param options.count - Number of plates to generate
   * @param options.minRadius - Minimum radius in radians
   * @param options.maxRadius - Maximum radius in radians
   * @returns Array of plates with evenly distributed radii
   */
  public static generateLargePlates(options: {
    planetRadius: number;
    count: number;
    minRadius: number;
    maxRadius: number;
  }): PlateExtendedIF[] {
    const plates: PlateExtendedIF[] = [];

    for (let i = 0; i < options.count; i++) {
      // Generate random radius between minRadius and maxRadius (in radians)
      const radiusInRadians =
        options.minRadius +
        Math.random() * (options.maxRadius - options.minRadius);

      // Convert radius from radians to kilometers
      // For a sphere, arc length = radius * angle, so plate radius = planet radius * angle in radians
      const radius = options.planetRadius * radiusInRadians;

      // Generate random density between 2.5 and 3.5 g/cm³ (geological range)
      const density = 2.5 + Math.random() * 1.0; // 2.5-3.5 g/cm³

      // Generate random thickness between 7 and 35 km for large plates (geological range)
      const thickness = 7 + Math.random() * 28; // 7-35 km

      // Calculate area based on radius (now in km)
      const area = Math.PI * radius * radius;

      // Calculate planet surface area for coverage calculation
      const planetSurfaceArea =
        4 * Math.PI * options.planetRadius * options.planetRadius;
      const coveragePercent = (area / planetSurfaceArea) * 100;

      // Calculate mass (volume * density, converting density from g/cm³ to kg/km³)
      const volume = area * thickness;
      const densityKgPerKm3 = density * 1e12; // Convert g/cm³ to kg/km³
      const mass = volume * densityKgPerKm3;

      // Assign a temporary rank (will be properly ranked later if needed)
      const rank = i + 1;

      // Determine behavioral type based on density
      let behavioralType: 'continental-like' | 'oceanic-like' | 'transitional';
      if (density < 0.9) {
        behavioralType = 'continental-like';
      } else if (density > 1.1) {
        behavioralType = 'oceanic-like';
      } else {
        behavioralType = 'transitional';
      }

      plates.push({
        id: uuidV4(),
        radius,
        density,
        thickness,
        area,
        coveragePercent,
        mass,
        rank,
        behavioralType,
      });
    }

    return plates;
  }
}
