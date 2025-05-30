/**
 * Worker Manifest Registry - A multiverse of worker capabilities
 */

export * from './computation-manifest';
export * from './data-processing-manifest';
export * from './ai-inference-manifest';
export * from './image-processing-manifest';
export * from './geospatial-manifest';
export * from './crypto-manifest';
export * from './simulation-manifest';

import { COMPUTATION_WORKER_MANIFEST } from './computation-manifest';
import { DATA_PROCESSING_WORKER_MANIFEST } from './data-processing-manifest';
import { AI_INFERENCE_WORKER_MANIFEST } from './ai-inference-manifest';
import { IMAGE_PROCESSING_WORKER_MANIFEST } from './image-processing-manifest';
import { GEOSPATIAL_WORKER_MANIFEST } from './geospatial-manifest';
import { CRYPTO_WORKER_MANIFEST } from './crypto-manifest';
import { SIMULATION_WORKER_MANIFEST } from './simulation-manifest';
import type { WorkerManifest } from '../types';

/**
 * Registry of all available worker manifests
 */
export const WORKER_MANIFEST_REGISTRY = new Map<string, WorkerManifest>([
  ['computation', COMPUTATION_WORKER_MANIFEST],
  ['data-processing', DATA_PROCESSING_WORKER_MANIFEST],
  ['ai-inference', AI_INFERENCE_WORKER_MANIFEST],
  ['image-processing', IMAGE_PROCESSING_WORKER_MANIFEST],
  ['geospatial', GEOSPATIAL_WORKER_MANIFEST],
  ['crypto', CRYPTO_WORKER_MANIFEST],
  ['simulation', SIMULATION_WORKER_MANIFEST],
]);

/**
 * Get manifest by name
 */
export function getManifest(name: string): WorkerManifest | undefined {
  return WORKER_MANIFEST_REGISTRY.get(name);
}

/**
 * Get all available manifest names
 */
export function getAvailableManifests(): string[] {
  return Array.from(WORKER_MANIFEST_REGISTRY.keys());
}

/**
 * Find manifests that support a specific action
 */
export function findManifestsForAction(actionId: string): WorkerManifest[] {
  const results: WorkerManifest[] = [];
  
  for (const manifest of WORKER_MANIFEST_REGISTRY.values()) {
    if (manifest.actions.some(action => action.actionId === actionId)) {
      results.push(manifest);
    }
  }
  
  return results;
}

/**
 * Get action categories across all manifests
 */
export function getActionCategories(): Record<string, string[]> {
  const categories: Record<string, string[]> = {};
  
  for (const manifest of WORKER_MANIFEST_REGISTRY.values()) {
    const category = manifest.name;
    categories[category] = manifest.actions.map(action => action.actionId);
  }
  
  return categories;
}

/**
 * Recommend worker bank configuration based on workload
 */
export function recommendBankConfiguration(
  expectedActions: string[],
  concurrency: number = 4
): Array<{ manifest: WorkerManifest; workerCount: number; priority: number }> {
  const recommendations: Array<{ manifest: WorkerManifest; workerCount: number; priority: number }> = [];
  
  // Count action frequency by manifest
  const manifestUsage = new Map<string, number>();
  
  for (const actionId of expectedActions) {
    const manifests = findManifestsForAction(actionId);
    for (const manifest of manifests) {
      const current = manifestUsage.get(manifest.name) || 0;
      manifestUsage.set(manifest.name, current + 1);
    }
  }
  
  // Create recommendations based on usage
  for (const [manifestName, usage] of manifestUsage.entries()) {
    const manifest = getManifest(manifestName);
    if (!manifest) continue;
    
    const priority = usage / expectedActions.length;
    const workerCount = Math.max(1, Math.ceil(concurrency * priority));
    
    recommendations.push({
      manifest,
      workerCount,
      priority,
    });
  }
  
  // Sort by priority (highest first)
  recommendations.sort((a, b) => b.priority - a.priority);
  
  return recommendations;
}
