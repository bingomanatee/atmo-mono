# Plate Generator

This directory contains generators for creating tectonic plates with realistic physical properties.

## PlateSpectrumGenerator

The `PlateSpectrumGenerator` creates a distribution of tectonic plates following a power law size distribution, where plate properties (density, thickness) correlate with size in a physically realistic way.

### Key Features

- Generates plates with a power law size distribution (many small plates, few large plates)
- Models plates on a continuous spectrum rather than discrete "continental" and "oceanic" categories
- Larger plates tend to be less dense (continental-like) while smaller plates tend to be more dense (oceanic-like)
- Automatically calculates physical properties like mass based on size, density, and thickness
- Provides detailed statistics about the generated plate distribution

### Usage Example

```typescript
import { PlateSpectrumGenerator } from './generator/PlateSpectrumGenerator';

// Basic usage with minimal configuration
const plateManifest = PlateSpectrumGenerator.generatePlates({
  planetRadius: 6371, // Earth radius in km
  plateCount: 12, // Number of plates to generate
});

// Advanced usage with full configuration
const generator = new PlateSpectrumGenerator({
  planetRadius: 6371, // km
  plateCount: 12,
  targetCoverage: 0.85, // 85% of planet surface
  powerLawExponent: 2.0, // Controls size distribution skew
  minDensity: 2.7, // g/cm³, continental-like
  maxDensity: 3.0, // g/cm³, oceanic-like
  minThickness: 7, // km, oceanic-like
  maxThickness: 35, // km, continental-like
  variationFactor: 0.2, // Random variation (0-1)
});

const result = generator.generate();

// Access plate data
const largestPlate = result.plates[0]; // Plates are sorted by size (largest first)
console.log(
  `Largest plate: ${largestPlate.area} km², ${largestPlate.behavioralType}`,
);

// Access summary statistics
console.log(`Total coverage: ${result.summary.totalCoverage}%`);
console.log(`Continental-like: ${result.summary.continentalLikePlates} plates`);
console.log(`Oceanic-like: ${result.summary.oceanicLikePlates} plates`);
```

### Configuration Options

| Parameter          | Description                                                       | Default    |
| ------------------ | ----------------------------------------------------------------- | ---------- |
| `planetRadius`     | Planet radius in kilometers                                       | (required) |
| `plateCount`       | Total number of plates to generate                                | (required) |
| `targetCoverage`   | Target percentage of planet surface to be covered by plates (0-1) | 0.85       |
| `powerLawExponent` | Power law exponent for size distribution (higher = more skewed)   | 2.0        |
| `minDensity`       | Minimum density in g/cm³ (typically for largest plates)           | 2.7        |
| `maxDensity`       | Maximum density in g/cm³ (typically for smallest plates)          | 3.0        |
| `minThickness`     | Minimum thickness in km (typically for smallest plates)           | 7          |
| `maxThickness`     | Maximum thickness in km (typically for largest plates)            | 35         |
| `variationFactor`  | Random variation factor (0-1) to apply to properties              | 0.2        |

### Tips for Realistic Plate Generation

1. **Plate Count**: Earth has about 7-8 major plates and numerous smaller ones. For Earth-sized planets, 10-15 plates is a good starting point.

2. **Power Law Exponent**:

   - Values around 1.5-2.0 produce realistic distributions
   - Higher values (2.5-3.0) create more extreme size differences
   - Lower values (1.0-1.5) create more uniformly sized plates

3. **Density Range**:

   - Continental crust: ~2.7-2.8 g/cm³
   - Oceanic crust: ~2.9-3.0 g/cm³
   - Wider ranges create more distinct plate types

4. **Thickness Range**:

   - Continental crust: ~25-70 km (thicker in mountain regions)
   - Oceanic crust: ~5-10 km
   - Wider ranges create more distinct plate types

5. **Variation Factor**:
   - Higher values (0.3-0.5) create more random, chaotic distributions
   - Lower values (0.1-0.2) create more predictable, orderly distributions
   - 0.2 is a good balance for Earth-like planets

### Output Structure

The generator returns a `PlateManifest` object with the following structure:

````typescript
{
  config: {
    // The configuration used, with defaults applied
  },
  plates: [
    // Array of generated plate objects
    {
      id: string;
      radius: number;  // km
      area: number;    // km²
      coveragePercent: number;
      density: number; // g/cm³
      thickness: number; // km
      mass: number;    // kg
      rank: number;    // 1 = largest
      behavioralType: 'continental-like' | 'oceanic-like' | 'transitional';
    }
  ],
  summary: {
    totalPlates: number;
    totalCoverage: number;
    planetSurfaceArea: number;
    continentalLikePlates: number;
    oceanicLikePlates: number;
    transitionalPlates: number;
    continentalLikeCoverage: number;
    oceanicLikeCoverage: number;
    transitionalCoverage: number;
  }
}

### Usage Example

```typescript
import { PlateSpectrumGenerator } from './generator/PlateSpectrumGenerator';

// Using the static method (simplest approach)
const plateManifest = PlateSpectrumGenerator.generatePlates({
  planetRadius: 6371, // Earth radius in km
  plateCount: 12      // Number of plates to generate
});

// Using the instance method (for more control)
const generator = new PlateSpectrumGenerator({
  planetRadius: 6371,  // km
  plateCount: 12,
  targetCoverage: 0.85,  // 85% of planet surface covered by plates
  powerLawExponent: 2.0, // Controls how skewed the size distribution is
  minDensity: 2.7,       // g/cm³, for largest plates (continental-like)
  maxDensity: 3.0,       // g/cm³, for smallest plates (oceanic-like)
  minThickness: 7,       // km, for smallest plates
  maxThickness: 35,      // km, for largest plates
  variationFactor: 0.2   // Random variation to apply (0-1)
});

const plateManifest = generator.generate();

// Access the generated plates
plateManifest.plates.forEach(plate => {
  console.log(`Plate ${plate.id}:`);
  console.log(`  Radius: ${plate.radius.toFixed(2)} km`);
  console.log(`  Area: ${plate.area.toFixed(2)} km²`);
  console.log(`  Coverage: ${plate.coveragePercent.toFixed(2)}%`);
  console.log(`  Density: ${plate.density.toFixed(2)} g/cm³`);
  console.log(`  Thickness: ${plate.thickness.toFixed(2)} km`);
  console.log(`  Mass: ${(plate.mass / 1e18).toFixed(2)}×10¹⁸ kg`);
  console.log(`  Type: ${plate.behavioralType}`);
});

// Access summary statistics
console.log(`Total plates: ${plateManifest.summary.totalPlates}`);
console.log(`Total coverage: ${plateManifest.summary.totalCoverage.toFixed(2)}%`);
console.log(`Continental-like plates: ${plateManifest.summary.continentalLikePlates}`);
console.log(`Oceanic-like plates: ${plateManifest.summary.oceanicLikePlates}`);
console.log(`Transitional plates: ${plateManifest.summary.transitionalPlates}`);
````
