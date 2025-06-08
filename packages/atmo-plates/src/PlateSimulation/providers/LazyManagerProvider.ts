import { Universe } from '@wonderlandlabs/multiverse';
import { ContextProvider, MANAGER_TYPES } from '../interfaces/ContextProvider';
import { PlateletManager } from '../managers/PlateletManager';
import PlateSimulationPlateManager from '../managers/PlateSimulationPlateManager';
import { PlateletCollisionManager } from '../managers/PlateletCollisionManager';

/**
 * Lazy context provider that creates managers on-demand
 * Perfect for worker contexts where you only want to instantiate what you need
 */
export class LazyContextProvider implements ContextProvider {
  readonly universe: Universe;
  private managerCache = new Map<string, any>();

  constructor(universe: Universe) {
    this.universe = universe;
  }

  /**
   * Get a manager instance, creating it lazily if it doesn't exist
   */
  getManager<T = any>(managerName: string): T {
    // Check cache first
    const cacheKey = `${managerName}-${this.universe.name || 'default'}`;
    if (this.managerCache.has(cacheKey)) {
      return this.managerCache.get(cacheKey);
    }

    // Create manager based on type
    let manager: any;

    switch (managerName) {
      case MANAGER_TYPES.PLATELET:
        manager = new PlateletManager(this.universe);
        break;

      case MANAGER_TYPES.PLATE:
        manager = new PlateSimulationPlateManager(this.universe);
        break;

      case MANAGER_TYPES.COLLISION:
        manager = new PlateletCollisionManager(this.universe);
        break;

      default:
        throw new Error(`Unknown manager type: ${managerName}`);
    }

    // Cache the manager
    this.managerCache.set(cacheKey, manager);

    return manager as T;
  }

  /**
   * Clear the manager cache (useful for cleanup)
   */
  clearCache(): void {
    this.managerCache.clear();
  }

  /**
   * Get all cached managers (useful for cleanup)
   */
  getAllManagers(): any[] {
    return Array.from(this.managerCache.values());
  }

  /**
   * Check if a manager is cached
   */
  hasManager(managerName: string): boolean {
    const cacheKey = `${managerName}-${this.universe.name || 'default'}`;
    return this.managerCache.has(cacheKey);
  }
}
