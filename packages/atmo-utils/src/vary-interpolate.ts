/**
 * Utility function that combines interpolation and variation in one step
 *
 * This is an extension of the vary function that also handles interpolation
 * between min and max values based on a t parameter.
 */

import { clamp } from 'lodash-es';

/**
 * Interpolate between min and max values with natural variation
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @param t - Interpolation factor (0-1)
 * @param variationFactor - Percentage of variation (0-1)
 * @returns Interpolated value with natural variation
 */
export function varyInterpolate(
  min: number,
  max: number,
  t: number,
  variationFactor: number
): number {
  // Calculate the interpolated base value
  const baseValue = min + (max - min) * t;

  // Calculate the range for variation
  const range = baseValue * variationFactor;

  // Apply random variation
  const scale = Math.random() * 2 - 1;
  const value = baseValue + range * scale;

  // Clamp to min and max
  return clamp(value, min, max);
}
