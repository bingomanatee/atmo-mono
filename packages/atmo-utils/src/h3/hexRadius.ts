const EARTH_RADIUS = 6371008.8; // meters
const level0hexRadiusOnEarth = 1077580; // Half of the center-to-center distance at res 0

// Cache for radius calculations
const radiusCache = new Map<string, number>();

export function h3HexRadiusAtResolution(
  planetRadius: number,
  levels: number
): number {
  const cacheKey = `${planetRadius}-${levels}`;

  if (radiusCache.has(cacheKey)) {
    return radiusCache.get(cacheKey)!;
  }

  // meters
  const baseHexRadius = (planetRadius / EARTH_RADIUS) * level0hexRadiusOnEarth;

  // H3 scales by ~2.64 per resolution increase (√7), not 0.5
  const scalingFactor = Math.pow(1 / 2.64, levels);

  // Compute the hexagon radius at the target resolution
  const radius = baseHexRadius * scalingFactor;

  radiusCache.set(cacheKey, radius);
  return radius;
}