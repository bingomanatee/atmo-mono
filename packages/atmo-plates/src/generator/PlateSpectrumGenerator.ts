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

export class PlateSpectrumGenerator {
  private config: Required<PlateGeneratorConfig>;
  private planetSurfaceArea: number;

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
      maxPlateRadius: config.maxPlateRadius, // Receive maxPlateRadius
    };

    this.planetSurfaceArea = calculateSphereSurfaceArea(config.planetRadius);
  }

  // Static convenience method to generate plates without creating an instance
  public static generatePlates(config: PlateGeneratorConfig): PlateManifest {
    const generator = new PlateSpectrumGenerator(config);
    return generator.generate();
  }
  public generate(): PlateManifest {
    const plates = this.generatePlates(); // Initial generation

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
}
