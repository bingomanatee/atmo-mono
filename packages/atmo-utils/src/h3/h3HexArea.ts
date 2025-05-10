import { EARTH_RADIUS } from './constants.ts';

const A0 = 4.25e8; // Base area of H3 hex at level 0 (425,000,000 m²)

export function h3HexArea(level: number, planetRadius: number): number {
  if (level < 0 || level > 15) {
    throw new Error('H3 level must be between 0 and 15.');
  }

  // Scale area by the square of the radius ratio
  // Area scales with the square of radius for similar shapes
  const radiusRatio = planetRadius / EARTH_RADIUS;
  const scaledA0 = A0 * (radiusRatio * radiusRatio);

  // Scale by H3 resolution level
  return scaledA0 / Math.pow(7, level);
}
