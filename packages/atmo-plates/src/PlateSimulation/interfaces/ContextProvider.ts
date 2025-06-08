import { Universe } from '@wonderlandlabs/multiverse';

/**
 * Context provider that encapsulates universe and manager access
 * Allows dependency injection in different contexts (main thread, workers, tests)
 */
export interface ContextProvider {
  /**
   * The universe instance for this context
   */
  readonly universe: Universe;

  /**
   * Get a manager instance by name
   * @param managerName - The name/type of manager to retrieve
   * @returns The manager instance
   */
  getManager<T = any>(managerName: string): T;
}

/**
 * Manager names/types for consistent referencing
 */
export const MANAGER_TYPES = {
  PLATELET: 'plateletManager',
  PLATE: 'plateManager',
  COLLISION: 'collisionManager',
} as const;

export type ManagerType = (typeof MANAGER_TYPES)[keyof typeof MANAGER_TYPES];
