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
    const plates = this.generatePlates(); // Generate plates with built-in radius constraints

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

    // Calculate maximum allowed radius in km
    const maxAllowedLinearRadius =
      (this.config.maxPlateRadius ?? Math.PI / 6) * this.config.planetRadius;
    const maxAllowedArea =
      Math.PI * maxAllowedLinearRadius * maxAllowedLinearRadius;

    const targetArea = this.planetSurfaceArea * targetCoverage;
    const plateAreas = this.generateConstrainedPowerLawSizes(
      plateCount,
      powerLawExponent,
      maxAllowedArea,
      targetArea,
    );

    return plateAreas.map((area, index) => {
      const rank = index + 1;

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
        coveragePercent: (area / this.planetSurfaceArea) * 100,
        density,
        thickness,
        mass,
        rank,
        behavioralType,
      };
    });
  }

  /**
   * Generate constrained power law distribution values that respect maximum area limits
   *
   * @param count - Number of values to generate
   * @param exponent - Power law exponent (higher = more skewed)
   * @param maxAllowedArea - Maximum allowed area for any plate
   * @param targetTotalArea - Target total area for all plates
   * @returns Array of area values following a power law distribution within constraints
   */
  private generateConstrainedPowerLawSizes(
    count: number,
    exponent: number,
    maxAllowedArea: number,
    targetTotalArea: number,
  ): number[] {
    // Generate initial power law distribution
    const rawSizes = Array.from({ length: count }, (_, i) =>
      Math.pow(i + 1, -exponent),
    );

    // Normalize to target total area
    const rawSum = rawSizes.reduce((a, b) => a + b, 0);
    let areas = rawSizes.map((size) => (size / rawSum) * targetTotalArea);

    // Check if largest plate exceeds maximum allowed area
    const largestArea = Math.max(...areas);

    if (largestArea > maxAllowedArea) {
      // Scale down the distribution so the largest plate equals maxAllowedArea
      const scaleFactor = maxAllowedArea / largestArea;
      areas = areas.map((area) => area * scaleFactor);
    }

    return areas;
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

  /**
   * Calculate the current coverage percentage of a set of plates
   * @param plates - Array of plates to calculate coverage for
   * @returns Coverage percentage (0-100)
   */
  private calculateCoverage(plates: PlateExtendedIF[]): number {
    const totalArea = plates.reduce((sum, plate) => sum + plate.area, 0);
    return (totalArea / this.planetSurfaceArea) * 100;
  }

  /**
   * Iteratively generate additional plates to achieve target coverage
   * @param existingPlates - Current plates
   * @param targetCoveragePercent - Target coverage percentage (0-100)
   * @returns Updated plates array with additional plates to meet coverage
   */
  private iterativelyAchieveTargetCoverage(
    existingPlates: PlateExtendedIF[],
    targetCoveragePercent: number,
  ): PlateExtendedIF[] {
    let plates = [...existingPlates];
    let currentCoverage = this.calculateCoverage(plates);
    let iteration = 0;
    const maxIterations = 10; // Prevent infinite loops

    console.log(
      `Initial coverage after capping: ${currentCoverage.toFixed(2)}%, target: ${targetCoveragePercent.toFixed(2)}%`,
    );

    while (
      currentCoverage < targetCoveragePercent &&
      iteration < maxIterations
    ) {
      iteration++;

      // Generate a new batch of plates (same count as original)
      const newBatch = this.generatePlates();

      // Apply radius capping to new batch
      const maxAllowedLinearRadius =
        (this.config.maxPlateRadius ?? Math.PI / 6) * this.config.planetRadius;

      newBatch.forEach((plate) => {
        if (plate.radius > maxAllowedLinearRadius) {
          plate.radius = maxAllowedLinearRadius;
          plate.area = Math.PI * Math.pow(plate.radius, 2);
          const volume = calculatePlateVolume(plate.area, plate.thickness);
          plate.mass = calculateMass(volume, plate.density);
        }
      });

      // Sort by area (largest first) and take the biggest 25%
      newBatch.sort((a, b) => b.area - a.area);
      const top25Percent = Math.max(1, Math.floor(newBatch.length * 0.25));
      const selectedPlates = newBatch.slice(0, top25Percent);

      // Update IDs to avoid conflicts
      selectedPlates.forEach((plate, index) => {
        plate.id = `plate-iter${iteration}-${index + 1}`;
        plate.rank = plates.length + index + 1;
      });

      // Add selected plates to the collection
      plates.push(...selectedPlates);

      // Recalculate coverage
      currentCoverage = this.calculateCoverage(plates);

      console.log(
        `Iteration ${iteration}: Added ${selectedPlates.length} plates, coverage now: ${currentCoverage.toFixed(2)}%`,
      );
    }

    if (currentCoverage < targetCoveragePercent) {
      console.log(
        `Warning: Could not achieve target coverage after ${maxIterations} iterations. Final coverage: ${currentCoverage.toFixed(2)}%`,
      );
    } else {
      console.log(
        `Successfully achieved target coverage: ${currentCoverage.toFixed(2)}% (target: ${targetCoveragePercent.toFixed(2)}%)`,
      );
    }

    return plates;
  }
}
