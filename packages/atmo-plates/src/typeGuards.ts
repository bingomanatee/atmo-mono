import type { Vector3Like } from 'three';
import { PLATE_TYPES } from './constants';
import {
  PlateIF,
  PlateExtendedIF,
  PlateSimExtendedIF,
  PlateTypeValue,
  Identifiable,
  PlateDistributionSummary,
  PlateManifest,
  PlateGeneratorConfig,
  SimSimulation,
  PlanetIF,
  SimPlanetIF,
} from './types.atmo-plates';

/**
 * Type guard for Identifiable objects
 */
export function isIdentifiable(obj: unknown): obj is Identifiable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as Identifiable).id === 'string'
  );
}

/**
 * Type guard for PlateIF objects
 */
export function isPlateIF(obj: unknown): obj is PlateIF {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'radius' in obj &&
    typeof (obj as PlateIF).radius === 'number' &&
    'density' in obj &&
    typeof (obj as PlateIF).density === 'number' &&
    'thickness' in obj &&
    typeof (obj as PlateIF).thickness === 'number'
  );
}

/**
 * Type guard for PlateExtendedIF objects
 */
export function isPlateExtendedIF(obj: unknown): obj is PlateExtendedIF {
  return (
    isPlateIF(obj) &&
    'area' in obj &&
    typeof (obj as PlateExtendedIF).area === 'number' &&
    'coveragePercent' in obj &&
    typeof (obj as PlateExtendedIF).coveragePercent === 'number' &&
    'mass' in obj &&
    typeof (obj as PlateExtendedIF).mass === 'number' &&
    'rank' in obj &&
    typeof (obj as PlateExtendedIF).rank === 'number' &&
    'behavioralType' in obj &&
    isPlateTypeValue((obj as PlateExtendedIF).behavioralType)
  );
}

/**
 * Type guard for PlateTypeValue
 */
export function isPlateTypeValue(value: unknown): value is PlateTypeValue {
  return (
    typeof value === 'string' &&
    (value === PLATE_TYPES.CONTINENTAL ||
      value === PLATE_TYPES.OCEANIC ||
      value === PLATE_TYPES.TRANSITIONAL)
  );
}

/**
 * Type guard for Vector3Like objects
 */
export function isVector3Like(obj: unknown): obj is Vector3Like {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'x' in obj &&
    typeof (obj as Vector3Like).x === 'number' &&
    'y' in obj &&
    typeof (obj as Vector3Like).y === 'number' &&
    'z' in obj &&
    typeof (obj as Vector3Like).z === 'number'
  );
}

/**
 * Type guard for PlateSimExtendedIF objects
 */
export function isPlateSimExtendedIF(obj: unknown): obj is PlateSimExtendedIF {
  return (
    isPlateExtendedIF(obj) &&
    isIdentifiable(obj) &&
    'planetId' in obj &&
    typeof (obj as PlateSimExtendedIF).planetId === 'string' &&
    'position' in obj &&
    isVector3Like((obj as PlateSimExtendedIF).position)
  );
}

/**
 * Type guard for PlateGeneratorConfig objects
 */
export function isPlateGeneratorConfig(
  obj: unknown,
): obj is PlateGeneratorConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'planetRadius' in obj &&
    typeof (obj as PlateGeneratorConfig).planetRadius === 'number' &&
    'plateCount' in obj &&
    typeof (obj as PlateGeneratorConfig).plateCount === 'number'
  );
}

/**
 * Type guard for PlateDistributionSummary objects
 */
export function isPlateDistributionSummary(
  obj: unknown,
): obj is PlateDistributionSummary {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'totalPlates' in obj &&
    typeof (obj as PlateDistributionSummary).totalPlates === 'number' &&
    'totalCoverage' in obj &&
    typeof (obj as PlateDistributionSummary).totalCoverage === 'number' &&
    'planetSurfaceArea' in obj &&
    typeof (obj as PlateDistributionSummary).planetSurfaceArea === 'number' &&
    'continentalLikePlates' in obj &&
    typeof (obj as PlateDistributionSummary).continentalLikePlates ===
      'number' &&
    'oceanicLikePlates' in obj &&
    typeof (obj as PlateDistributionSummary).oceanicLikePlates === 'number' &&
    'transitionalPlates' in obj &&
    typeof (obj as PlateDistributionSummary).transitionalPlates === 'number' &&
    'continentalLikeCoverage' in obj &&
    typeof (obj as PlateDistributionSummary).continentalLikeCoverage ===
      'number' &&
    'oceanicLikeCoverage' in obj &&
    typeof (obj as PlateDistributionSummary).oceanicLikeCoverage === 'number' &&
    'transitionalCoverage' in obj &&
    typeof (obj as PlateDistributionSummary).transitionalCoverage === 'number'
  );
}

/**
 * Type guard for PlateManifest objects
 */
export function isPlateManifest(obj: unknown): obj is PlateManifest {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !('config' in obj) ||
    !('plates' in obj) ||
    !('summary' in obj)
  ) {
    return false;
  }

  const manifest = obj as PlateManifest;

  if (!isPlateGeneratorConfig(manifest.config)) {
    return false;
  }

  if (!Array.isArray(manifest.plates)) {
    return false;
  }

  if (manifest.plates.length > 0 && !isPlateExtendedIF(manifest.plates[0])) {
    return false;
  }

  if (!isPlateDistributionSummary(manifest.summary)) {
    return false;
  }

  return true;
}

/**
 * Type guard for SimSimulation objects
 */
export function isSimSimulation(obj: unknown): obj is SimSimulation {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as SimSimulation).id === 'string' &&
    'name' in obj &&
    typeof (obj as SimSimulation).name === 'string' &&
    'planetId' in obj &&
    typeof (obj as SimSimulation).planetId === 'string'
  );
}

/**
 * Type guard for PlanetIF objects
 */
export function isPlanetIF(obj: unknown): obj is PlanetIF {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'radius' in obj &&
    typeof (obj as PlanetIF).radius === 'number' &&
    (!('name' in obj) || typeof (obj as PlanetIF).name === 'string')
  );
}

/**
 * Type guard for SimPlanetIF objects
 */
export function isSimPlanetIF(obj: unknown): obj is SimPlanetIF {
  return (
    isPlanetIF(obj) &&
    isIdentifiable(obj) &&
    (!('name' in obj) || typeof (obj as SimPlanetIF).name === 'string')
  );
}
