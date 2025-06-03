/**
 * H3 Utilities
 *
 * This file provides utility functions for working with the H3 geospatial indexing system.
 * It includes functions for calculating cell areas, radii, and conversions between
 * geographic coordinates and H3 indices.
 */

import * as h3 from 'h3-js';
import { EARTH_RADIUS } from './constants.ts';

// Constants
const res0CellRadiusOnEarth = 1077.58; // Half of the center-to-center distance at res 0 in km (was 1077580 m)
const A0 = 425000; // Base area of H3 cell at resolution 0 (425,000 km²) (was 425,000,000 m²)

// Cache for radius calculations
const radiusCache = new Map<string, number>();

/**
 * Calculate the radius of an H3 cell at a specific resolution for a planet
 *
 * @param planetRadius - The radius of the planet in kilometers
 * @param resolution - The H3 resolution (0-15)
 * @returns The radius of the cell in kilometers
 */
export function h3HexRadiusAtResolution(
  planetRadius: number,
  resolution: number,
): number {
  if (resolution < 0 || resolution > 15) {
    throw new Error('H3 resolution must be between 0 and 15.');
  }

  const cacheKey = `${planetRadius}-${resolution}`;

  if (radiusCache.has(cacheKey)) {
    return radiusCache.get(cacheKey)!;
  }

  // Calculate in kilometers (everything is already in km)
  const baseCellRadius = (planetRadius / EARTH_RADIUS) * res0CellRadiusOnEarth;

  // H3 scales by ~2.64 per resolution increase (√7), not 0.5
  const scalingFactor = Math.pow(1 / 2.64, resolution);

  // Compute the cell radius at the target resolution in kilometers
  const radius = baseCellRadius * scalingFactor;

  // Add detailed logging for debugging
  console.log(`
    🔍 H3 Cell Radius Calculation:
    Planet radius: ${planetRadius}km
    Resolution: ${resolution}
    Base cell radius: ${baseCellRadius.toFixed(2)}km
    Scaling factor: ${scalingFactor.toFixed(4)}
    Final radius: ${radius.toFixed(2)}km
  `);

  radiusCache.set(cacheKey, radius);
  return radius;
}

/**
 * Calculate the area of an H3 cell at a specific resolution for a planet
 *
 * @param resolution - The H3 resolution (0-15)
 * @param planetRadius - The radius of the planet in kilometers
 * @returns The area of the cell in square kilometers
 */
export function h3HexArea(resolution: number, planetRadius: number): number {
  if (resolution < 0 || resolution > 15) {
    throw new Error('H3 resolution must be between 0 and 15.');
  }

  // Scale area by the square of the radius ratio
  // Area scales with the square of radius for similar shapes
  const radiusRatio = planetRadius / EARTH_RADIUS;
  const scaledA0 = A0 * (radiusRatio * radiusRatio);

  // Scale by H3 resolution
  return scaledA0 / Math.pow(7, resolution);
}

/**
 * Convert latitude and longitude to an H3 cell index
 *
 * @param lat - Latitude in degrees
 * @param lng - Longitude in degrees
 * @param resolution - The H3 resolution (0-15)
 * @returns The H3 cell index as a string
 */
export function latLngToCell(
  lat: number,
  lng: number,
  resolution: number,
): string {
  if (resolution < 0 || resolution > 15) {
    throw new Error('H3 resolution must be between 0 and 15.');
  }

  return h3.latLngToCell(lat, lng, resolution);
}

/**
 * Convert an H3 cell index to latitude and longitude (center of the cell)
 *
 * @param h3Index - The H3 cell index as a string
 * @returns An object with lat and lng properties in degrees
 */
export function cellToLatLng(h3Index: string): { lat: number; lng: number } {
  const [lat, lng] = h3.cellToLatLng(h3Index);
  return { lat, lng };
}

/**
 * Get the resolution of an H3 cell index
 *
 * @param h3Index - The H3 cell index as a string
 * @returns The resolution (0-15)
 */
export function getResolution(h3Index: string): number {
  return h3.getResolution(h3Index);
}

/**
 * Get the neighbors of an H3 cell
 *
 * @param h3Index - The H3 cell index as a string
 * @returns An array of neighboring H3 cell indices
 */
export function getNeighbors(h3Index: string): string[] {
  return h3.gridDisk(h3Index, 1).filter((index) => index !== h3Index);
}

/**
 * Get all cells within a given distance of an H3 cell
 *
 * @param h3Index - The H3 cell index as a string
 * @param distance - The distance in grid cells (k-ring)
 * @returns An array of H3 cell indices within the specified distance
 */
export function getCellsInRange(h3Index: string, distance: number): string[] {
  try {
    return h3.gridDisk(h3Index, distance);
  } catch (err) {
    console.log('error calling getCellsInRange', h3Index, distance);
    throw err;
  }
}

/**
 * Check if two H3 cells are neighbors
 *
 * @param h3Index1 - The first H3 cell index
 * @param h3Index2 - The second H3 cell index
 * @returns True if the cells are neighbors, false otherwise
 */
export function areNeighborCells(h3Index1: string, h3Index2: string): boolean {
  return h3.areNeighborCells(h3Index1, h3Index2);
}

/**
 * Get the distance between two H3 cells (in grid cells)
 *
 * @param h3Index1 - The first H3 cell index
 * @param h3Index2 - The second H3 cell index
 * @returns The distance in grid cells
 */
export function gridDistance(h3Index1: string, h3Index2: string): number {
  return h3.gridDistance(h3Index1, h3Index2);
}

/**
 * Get the vertices of an H3 cell as latitude/longitude pairs
 *
 * @param h3Index - The H3 cell index
 * @returns An array of [lat, lng] pairs representing the vertices
 */
export function cellToBoundary(h3Index: string): [number, number][] {
  return h3.cellToBoundary(h3Index);
}

/**
 * Get the parent of an H3 cell at a specified resolution
 *
 * @param h3Index - The H3 cell index
 * @param resolution - The desired resolution of the parent
 * @returns The parent H3 cell index
 */
export function cellToParent(h3Index: string, resolution: number): string {
  const currentRes = h3.getResolution(h3Index);
  if (resolution >= currentRes) {
    throw new Error(
      'Parent resolution must be less than the current resolution',
    );
  }
  return h3.cellToParent(h3Index, resolution);
}

/**
 * Get the children of an H3 cell at a specified resolution
 *
 * @param h3Index - The H3 cell index
 * @param resolution - The desired resolution of the children
 * @returns An array of child H3 cell indices
 */
export function cellToChildren(h3Index: string, resolution: number): string[] {
  const currentRes = h3.getResolution(h3Index);
  if (resolution <= currentRes) {
    throw new Error(
      'Child resolution must be greater than the current resolution',
    );
  }
  return h3.cellToChildren(h3Index, resolution);
}

/**
 * Check if an H3 cell index is valid
 *
 * @param h3Index - The H3 cell index to check
 * @returns True if the index is valid, false otherwise
 */
export function isValidCell(h3Index: string): boolean {
  return h3.isValidCell(h3Index);
}

/**
 * Get the approximate area of an H3 cell in square meters
 * This uses the h3-js library's built-in function
 *
 * @param h3Index - The H3 cell index
 * @returns The area in square meters
 */
export function cellArea(h3Index: string): number {
  return h3.cellArea(h3Index, 'm²');
}

/**
 * Get the approximate edge length of an H3 cell in meters
 * This uses the h3-js library's built-in function
 *
 * @param h3Index - The H3 cell index
 * @returns The edge length in meters
 */
export function getEdgeLengthAvg(h3Index: string): number {
  return h3.getHexagonEdgeLengthAvg(h3.getResolution(h3Index), 'm');
}

/**
 * Convert a set of geographic coordinates to the closest H3 cell indices at the specified resolution
 *
 * @param points - Array of [lat, lng] coordinates
 * @param resolution - The H3 resolution (0-15)
 * @returns An array of H3 cell indices
 */
export function pointsToCell(
  points: [number, number][],
  resolution: number,
): string[] {
  return points.map(([lat, lng]) => h3.latLngToCell(lat, lng, resolution));
}

/**
 * Get a compact representation of a set of cells
 * This is useful for efficiently representing large areas
 *
 * @param h3Indices - Array of H3 cell indices
 * @returns A compacted array of H3 cell indices
 */
export function compactCells(h3Indices: string[]): string[] {
  return h3.compactCells(h3Indices);
}

/**
 * Uncompact a set of cells to the specified resolution
 *
 * @param compactedH3Indices - Array of compacted H3 cell indices
 * @param resolution - The resolution to uncompact to
 * @returns An array of H3 cell indices at the specified resolution
 */
export function uncompactCells(
  compactedH3Indices: string[],
  resolution: number,
): string[] {
  return h3.uncompactCells(compactedH3Indices, resolution);
}
