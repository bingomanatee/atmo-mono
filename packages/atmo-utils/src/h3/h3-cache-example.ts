/**
 * Example usage of H3 IndexedDB Cache
 * 
 * This file demonstrates how to use the H3 cache for faster H3 computations.
 */

import { h3Cache } from './h3-cache';
import { cellToVector, cellToVectorSync } from '../vector/cellToVector';
import { getNeighbors, getNeighborsSync } from './h3.utils';
import { latLngToCell } from './h3.utils';

/**
 * Example: Compare performance with and without caching
 */
export async function performanceComparison() {
  // Generate some test H3 cells
  const testCells = [
    latLngToCell(37.7749, -122.4194, 9), // San Francisco
    latLngToCell(40.7128, -74.0060, 9),  // New York
    latLngToCell(51.5074, -0.1278, 9),   // London
    latLngToCell(35.6762, 139.6503, 9),  // Tokyo
    latLngToCell(-33.8688, 151.2093, 9), // Sydney
  ];

  const radius = 6371; // Earth radius in km

  console.log('🚀 H3 Cache Performance Comparison');
  console.log('=====================================');

  // Check if cache is available
  const cacheAvailable = await h3Cache.isAvailable();
  console.log(`📊 Cache available: ${cacheAvailable}`);
  console.log(`⚙️  Cache info:`, h3Cache.getCacheInfo());

  // Test 1: Cell to Vector conversion
  console.log('\n📍 Testing cellToVector performance...');
  
  // First run (cold cache)
  const start1 = performance.now();
  for (const cell of testCells) {
    await cellToVector(cell, radius);
  }
  const end1 = performance.now();
  console.log(`   First run (cold cache): ${(end1 - start1).toFixed(2)}ms`);

  // Second run (warm cache)
  const start2 = performance.now();
  for (const cell of testCells) {
    await cellToVector(cell, radius);
  }
  const end2 = performance.now();
  console.log(`   Second run (warm cache): ${(end2 - start2).toFixed(2)}ms`);

  // Sync version for comparison
  const start3 = performance.now();
  for (const cell of testCells) {
    cellToVectorSync(cell, radius);
  }
  const end3 = performance.now();
  console.log(`   Sync version (no cache): ${(end3 - start3).toFixed(2)}ms`);

  // Test 2: Get neighbors
  console.log('\n🔗 Testing getNeighbors performance...');
  
  // First run (cold cache)
  const start4 = performance.now();
  for (const cell of testCells) {
    await getNeighbors(cell);
  }
  const end4 = performance.now();
  console.log(`   First run (cold cache): ${(end4 - start4).toFixed(2)}ms`);

  // Second run (warm cache)
  const start5 = performance.now();
  for (const cell of testCells) {
    await getNeighbors(cell);
  }
  const end5 = performance.now();
  console.log(`   Second run (warm cache): ${(end5 - start5).toFixed(2)}ms`);

  // Sync version for comparison
  const start6 = performance.now();
  for (const cell of testCells) {
    getNeighborsSync(cell);
  }
  const end6 = performance.now();
  console.log(`   Sync version (no cache): ${(end6 - start6).toFixed(2)}ms`);

  // Show cache stats
  const stats = await h3Cache.getCacheStats();
  if (stats) {
    console.log('\n📈 Cache Statistics:');
    console.log(`   Points cached: ${stats.points}`);
    console.log(`   Neighbors cached: ${stats.neighbors}`);
    console.log(`   LatLng cached: ${stats.latLng}`);
  }
}

/**
 * Example: Cache management
 */
export async function cacheManagementExample() {
  console.log('\n🛠️  Cache Management Example');
  console.log('============================');

  // Check initial state
  console.log(`Initial cache enabled: ${h3Cache.isCachingEnabled()}`);
  
  // Get some initial stats
  let stats = await h3Cache.getCacheStats();
  console.log('Initial cache stats:', stats);

  // Add some data to cache
  const testCell = latLngToCell(37.7749, -122.4194, 9);
  await cellToVector(testCell, 6371);
  await getNeighbors(testCell);

  // Check stats after adding data
  stats = await h3Cache.getCacheStats();
  console.log('Stats after adding data:', stats);

  // Disable caching
  h3Cache.setCachingEnabled(false);
  console.log(`Cache disabled: ${!h3Cache.isCachingEnabled()}`);

  // Try to use cache (should fall back to direct computation)
  const start = performance.now();
  await cellToVector(testCell, 6371);
  const end = performance.now();
  console.log(`Operation with cache disabled: ${(end - start).toFixed(2)}ms`);

  // Re-enable caching
  h3Cache.setCachingEnabled(true);
  console.log(`Cache re-enabled: ${h3Cache.isCachingEnabled()}`);

  // Clear cache
  await h3Cache.clearCache();
  console.log('Cache cleared');

  // Check final stats
  stats = await h3Cache.getCacheStats();
  console.log('Final cache stats:', stats);
}

/**
 * Example: Bulk operations with caching
 */
export async function bulkOperationsExample() {
  console.log('\n📦 Bulk Operations Example');
  console.log('===========================');

  // Generate a grid of H3 cells around San Francisco
  const centerLat = 37.7749;
  const centerLng = -122.4194;
  const resolution = 8;
  const gridSize = 10;

  const cells: string[] = [];
  for (let i = -gridSize; i <= gridSize; i++) {
    for (let j = -gridSize; j <= gridSize; j++) {
      const lat = centerLat + (i * 0.01);
      const lng = centerLng + (j * 0.01);
      cells.push(latLngToCell(lat, lng, resolution));
    }
  }

  console.log(`Generated ${cells.length} H3 cells for testing`);

  // Test bulk conversion with caching
  console.log('\n🔄 Converting cells to vectors...');
  const start1 = performance.now();
  const vectors = await Promise.all(
    cells.map(cell => cellToVector(cell, 6371))
  );
  const end1 = performance.now();
  console.log(`   Converted ${vectors.length} cells in ${(end1 - start1).toFixed(2)}ms`);

  // Test bulk neighbor lookup with caching
  console.log('\n🔗 Getting neighbors for all cells...');
  const start2 = performance.now();
  const allNeighbors = await Promise.all(
    cells.map(cell => getNeighbors(cell))
  );
  const end2 = performance.now();
  console.log(`   Got neighbors for ${allNeighbors.length} cells in ${(end2 - start2).toFixed(2)}ms`);

  // Show final cache stats
  const stats = await h3Cache.getCacheStats();
  if (stats) {
    console.log('\n📊 Final Cache Statistics:');
    console.log(`   Points cached: ${stats.points}`);
    console.log(`   Neighbors cached: ${stats.neighbors}`);
    console.log(`   LatLng cached: ${stats.latLng}`);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await performanceComparison();
    await cacheManagementExample();
    await bulkOperationsExample();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Auto-run examples if this file is executed directly
if (typeof window !== 'undefined' && window.location) {
  // Browser environment - you can call runAllExamples() manually
  console.log('💡 H3 Cache examples loaded. Call runAllExamples() to see them in action!');
} else if (typeof process !== 'undefined' && process.argv) {
  // Node.js environment
  if (process.argv[1]?.includes('h3-cache-example')) {
    runAllExamples();
  }
}
