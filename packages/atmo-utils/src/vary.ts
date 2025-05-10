import { clamp } from 'lodash-es';

/**
 * Parameters for the varyP function with base value
 */
export interface VaryParamsWithBase {
  /** Base value to vary */
  base: number;

  /** Percentage of variation (0-1) (default: 0.5) */
  pct?: number;

  /** Minimum allowed value (default: -Infinity) */
  min?: number;

  /** Maximum allowed value (default: Infinity) */
  max?: number;

  /** Flag to indicate this is a base-centered parameter set */
  lerp?: undefined;
}

/**
 * Parameters for the varyP function with min/max range
 */
export interface VaryParamsWithRange {
  /** Minimum allowed value */
  min: number;

  /** Maximum allowed value */
  max: number;

  /** Percentage of variation (0-1) (default: 0.5) */
  pct?: number;

  /** Linear interpolation factor (0-1) between min and max (default: 0.5) */
  lerp?: number;
}

/**
 * Union type for varyP parameters
 */
export type VaryParams = VaryParamsWithBase | VaryParamsWithRange;

/**
 * Type guard for VaryParamsWithBase
 */
function isBaseParams(params: VaryParams): params is VaryParamsWithBase {
  return 'base' in params && typeof params.base === 'number';
}

/**
 * Type guard for VaryParamsWithRange
 */
function isRangeParams(params: VaryParams): params is VaryParamsWithRange {
  return 'min' in params && 'max' in params && !('base' in params);
}

/**
 * Create a value with natural variation
 *
 * @param base - Base value to vary
 * @param pct - Percentage of variation (0-1)
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param lerp - Optional linear interpolation factor (0-1) between min and max
 * @returns Varied value
 */
export function vary(
  base: number,
  pct: number,
  min = -Infinity,
  max = Infinity,
  lerp?: number
): number {
  // If lerp is provided, use it to interpolate between min and max for the base value
  if (lerp !== undefined) {
    base = min + (max - min) * lerp;
  }

  const range = base * pct;
  const scale = Math.random() * 2 - 1;
  const value = base + range * scale;
  return clamp(value, min, max);
}

/**
 * Create a value with natural variation using parameter object
 *
 * This function can be used in two ways:
 * 1. Vary a base value by a percentage: varyP({ base, pct, min, max })
 * 2. Interpolate between min and max with variation: varyP({ min, max, pct, lerp })
 *
 * @param params - Parameters for variation
 * @returns Varied value
 */
export function varyP(params: VaryParams): number {
  // Use type guards to determine which algorithm to use
  if (isBaseParams(params)) {
    // Base-centered parameters
    const { base, pct = 0.5, min = -Infinity, max = Infinity } = params;
    return vary(base, pct, min, max);
  } else if (isRangeParams(params)) {
    // Range-centered parameters
    const { min, max, pct = 0.5, lerp = 0.5 } = params;

    // Calculate the interpolated base value
    const base = min + (max - min) * lerp;

    // Calculate the effective percentage based on the range
    const effectivePct = pct * 2; // Double the percentage to account for the range

    // Use the original vary function without passing lerp
    return vary(base, effectivePct, min, max);
  } else {
    // This should never happen due to TypeScript's type checking,
    // but we'll handle it just in case
    throw new Error('Invalid parameters for varyP');
  }
}
/**
 * Create a value with more dramatic variation (squared)
 *
 * @param base - Base value to vary
 * @param pct - Percentage of variation (0-1)
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param lerp - Optional linear interpolation factor (0-1) between min and max
 * @returns Varied value with more dramatic distribution
 */
export function varySq(
  base: number,
  pct: number,
  min = -Infinity,
  max = Infinity,
  lerp?: number
): number {
  // If lerp is provided, use it to interpolate between min and max for the base value
  if (lerp !== undefined) {
    base = min + (max - min) * lerp;
  }

  const range = base * pct;
  // Use a more dramatic random distribution to ensure more variation
  // This will give values between -1.5 and 1.5 with more spread
  const scale = (Math.random() * 2 - 1) * 1.5;
  const value = base + range * scale;

  return clamp(value, min, max);
}

/**
 * Create a value with more dramatic variation (squared) using parameter object
 *
 * This is similar to varyP but uses a more dramatic random distribution
 *
 * @param params - Parameters for variation
 * @returns Varied value with more dramatic distribution
 */
export function varySqP(params: VaryParams): number {
  // Use type guards to determine which algorithm to use
  if (isBaseParams(params)) {
    // Base-centered parameters
    const { base, pct = 0.5, min = -Infinity, max = Infinity } = params;
    return varySq(base, pct, min, max);
  } else if (isRangeParams(params)) {
    // Range-centered parameters
    const { min, max, pct = 0.5, lerp = 0.5 } = params;

    // Calculate the interpolated base value
    const base = min + (max - min) * lerp;

    // Calculate the effective percentage based on the range
    const effectivePct = pct * 2; // Double the percentage to account for the range

    // Use the original varySq function without passing lerp
    return varySq(base, effectivePct, min, max);
  } else {
    // This should never happen due to TypeScript's type checking,
    // but we'll handle it just in case
    throw new Error('Invalid parameters for varySqP');
  }
}
