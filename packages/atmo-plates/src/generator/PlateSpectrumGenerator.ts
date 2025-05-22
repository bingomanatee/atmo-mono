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
      targetCoverage: config.targetCoverage ?? 0.85, // 85% default coverage
      powerLawExponent: config.powerLawExponent ?? 2.0,
      minDensity: config.minDensity ?? 2.7, // g/cm³ (typical continental crust)
      maxDensity: config.maxDensity ?? 3.0, // g/cm³ (typical oceanic crust)
      minThickness: config.minThickness ?? 7, // km (typical oceanic crust)
      maxThickness: config.maxThickness ?? 35, // km (typical continental crust)
      variationFactor: config.variationFactor ?? 0.2,
    };

    this.planetSurfaceArea = calculateSphereSurfaceArea(config.planetRadius);
  }

  // Static convenience method to generate plates without creating an instance
  public static generatePlates(config: PlateGeneratorConfig): PlateManifest {
    const generator = new PlateSpectrumGenerator(config);
    return generator.generate();
  }
  public generate(): PlateManifest {
    const plates = this.generatePlates();

    const continentalLikePlates = plates.filter(
      (p) => p.behavioralType === 'continental-like',
    );
    const oceanicLikePlates = plates.filter(
      (p) => p.behavioralType === 'oceanic-like',
    );
    const transitionalPlates = plates.filter(
      (p) => p.behavioralType === 'transitional',
    );

    const continentalLikeCoverage = continentalLikePlates.reduce(
      (sum, plate) => sum + plate.coveragePercent,
      0,
    );

    const oceanicLikeCoverage = oceanicLikePlates.reduce(
      (sum, plate) => sum + plate.coveragePercent,
      0,
    );

    const transitionalCoverage = transitionalPlates.reduce(
      (sum, plate) => sum + plate.coveragePercent,
      0,
    );

    return {
      config: this.config,
      plates,
      summary: {
        totalPlates: plates.length,
        totalCoverage:
          continentalLikeCoverage + oceanicLikeCoverage + transitionalCoverage,
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
