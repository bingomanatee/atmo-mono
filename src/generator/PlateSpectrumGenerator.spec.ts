import { beforeEach, describe, expect, it } from 'vitest';
import {
  PlateSpectrumGenerator,
  type PlateGeneratorConfig,
  type PlateManifest,
} from './PlateSpectrumGenerator';

describe('PlateSpectrumGenerator:class', () => {
  let defaultConfig: PlateGeneratorConfig;

  beforeEach(() => {
    // Set up a default configuration for tests
    defaultConfig = {
      planetRadius: 6371, // Earth radius in km
      plateCount: 10,
      targetCoverage: 0.85,
      powerLawExponent: 2.0,
      minDensity: 2.7,
      maxDensity: 3.0,
      minThickness: 7,
      maxThickness: 35,
      variationFactor: 0.2,
    };
  });

  it('should generate plates with the static method', () => {
    const manifest = PlateSpectrumGenerator.generatePlates(defaultConfig);

    // Check that the manifest has the expected structure
    expect(manifest).toBeDefined();
    expect(manifest.config).toBeDefined();
    expect(manifest.plates).toBeDefined();
    expect(manifest.summary).toBeDefined();

    // Check that the correct number of plates was generated
    expect(manifest.plates.length).toBe(defaultConfig.plateCount);

    // Check that the total coverage is close to the target coverage
    expect(manifest.summary.totalCoverage).toBeCloseTo(
      defaultConfig.targetCoverage * 100,
      0,
    );
  });

  it('should generate plates with the instance method', () => {
    const generator = new PlateSpectrumGenerator(defaultConfig);
    const manifest = generator.generate();

    // Check that the manifest has the expected structure
    expect(manifest).toBeDefined();
    expect(manifest.config).toBeDefined();
    expect(manifest.plates).toBeDefined();
    expect(manifest.summary).toBeDefined();

    // Check that the correct number of plates was generated
    expect(manifest.plates.length).toBe(defaultConfig.plateCount);
  });

  it('should generate plates with a power law size distribution', () => {
    const manifest = PlateSpectrumGenerator.generatePlates(defaultConfig);
    const plates = manifest.plates;

    // Check that plates are sorted by rank (1 = largest)
    expect(plates[0].rank).toBe(1);
    expect(plates[plates.length - 1].rank).toBe(defaultConfig.plateCount);

    // Check that the first plate is larger than the last plate
    expect(plates[0].area).toBeGreaterThan(plates[plates.length - 1].area);

    // Check that the areas follow a power law distribution (approximately)
    // The ratio between consecutive plates should decrease
    const areaRatios = [];
    for (let i = 0; i < plates.length - 1; i++) {
      areaRatios.push(plates[i].area / plates[i + 1].area);
    }

    // Check that the first ratio is greater than the last ratio
    // This is a simple check that the distribution follows a power law
    expect(areaRatios[0]).toBeGreaterThan(areaRatios[areaRatios.length - 1]);
  });

  it('should assign properties based on plate size', () => {
    const manifest = PlateSpectrumGenerator.generatePlates(defaultConfig);
    const plates = manifest.plates;

    // Check that larger plates have lower or equal density
    expect(plates[0].density).toBeLessThanOrEqual(
      plates[plates.length - 1].density,
    );

    // Check that larger plates have greater or equal thickness
    expect(plates[0].thickness).toBeGreaterThanOrEqual(
      plates[plates.length - 1].thickness,
    );

    // Check that behavioral types are assigned correctly
    const continentalLikePlates = plates.filter(
      (p) => p.behavioralType === 'continental-like',
    );
    const oceanicLikePlates = plates.filter(
      (p) => p.behavioralType === 'oceanic-like',
    );

    expect(continentalLikePlates.length).toBeGreaterThan(0);
    expect(oceanicLikePlates.length).toBeGreaterThan(0);

    // Check that continental-like plates have lower density than oceanic-like plates
    if (continentalLikePlates.length > 0 && oceanicLikePlates.length > 0) {
      const avgContinentalDensity =
        continentalLikePlates.reduce((sum, p) => sum + p.density, 0) /
        continentalLikePlates.length;
      const avgOceanicDensity =
        oceanicLikePlates.reduce((sum, p) => sum + p.density, 0) /
        oceanicLikePlates.length;

      expect(avgContinentalDensity).toBeLessThan(avgOceanicDensity);
    }
  });

  it('should calculate mass correctly', () => {
    const manifest = PlateSpectrumGenerator.generatePlates(defaultConfig);
    const plates = manifest.plates;

    // Check that mass is calculated correctly for each plate
    plates.forEach((plate) => {
      // Mass = volume * density
      // Volume = area * thickness
      const volumeKm3 = plate.area * plate.thickness;
      const volumeM3 = volumeKm3 * 1e9; // Convert km³ to m³
      const densityKgPerM3 = plate.density * 1000; // Convert g/cm³ to kg/m³
      const expectedMass = volumeM3 * densityKgPerM3;

      expect(plate.mass).toBeCloseTo(expectedMass, -5); // Using a large tolerance due to floating point precision
    });
  });

  it('should handle custom configuration values', () => {
    // Create a custom configuration with different values
    const customConfig: PlateGeneratorConfig = {
      planetRadius: 3000, // Smaller planet
      plateCount: 5, // Fewer plates
      powerLawExponent: 3.0, // More skewed distribution
      minDensity: 2.5,
      maxDensity: 3.5,
      minThickness: 5,
      maxThickness: 40,
      variationFactor: 0.1,
    };

    const manifest = PlateSpectrumGenerator.generatePlates(customConfig);

    // Check that the configuration was used correctly
    expect(manifest.config.planetRadius).toBe(customConfig.planetRadius);
    expect(manifest.config.plateCount).toBe(customConfig.plateCount);
    expect(manifest.config.powerLawExponent).toBe(
      customConfig.powerLawExponent,
    );

    // Check that the correct number of plates was generated
    expect(manifest.plates.length).toBe(customConfig.plateCount);
  });
});
