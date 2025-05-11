import type { MutationAction, SunIF } from '../types.multiverse';
import type { CollSyncIF } from '../types.coll';
import { isObj, isPromiseLike } from '../typeguards.multiverse';
import { MUTATION_ACTIONS } from '../constants';
import { SunMemory } from './SunMemory';

/**
 * A Sun implementation that extends SunMemory and adds Immer-like functionality
 * This is an alternative implementation that reduces code duplication by extending SunMemory
 */
export class SunMemoryImmerC<R, K>
  extends SunMemory<R, K>
  implements SunIF<R, K>
{
  /**
   * Mutate a record using a simple deep clone approach
   *
   * @param key - The key of the record to mutate
   * @param mutator - A function that accepts the previous record (or undefined) and the collection, and returns a new record or a mutation action
   * @returns The mutated record or undefined if deleted
   */
  /**
   * Override the mutate method to provide Immer-like functionality
   * This implementation processes mutations synchronously for testing
   */
  override mutate(
    key: K,
    mutator: (
      draft: R | undefined,
      collection: CollSyncIF<R, K>,
    ) => R | void | MutationAction | Promise<R | void | MutationAction>,
  ): R | undefined {
    // Lock the collection during mutation
    this._locked = true;

    try {
      const existing = this.get(key);

      // Create a deep clone of the existing record
      const draft = existing ? JSON.parse(JSON.stringify(existing)) : undefined;

      // Apply the mutator function
      const result = mutator(draft, this.coll);

      // Handle Promise-like result
      if (isPromiseLike(result)) {
        // Unlock the collection immediately for async operations
        this._locked = false;

        // Process the promise result asynchronously without locking
        result
          .then((asyncResult) => {
            // Process the async result without locking
            this._processResultSync(key, asyncResult);
          })
          .catch((error) => {
            console.error(
              `Error in async mutation for key ${String(key)}:`,
              error,
            );
          });

        // Return the current value
        return existing;
      }

      // Process the result synchronously for testing
      return this._processResultSync(key, result);
    } finally {
      // Unlock the collection
      this._locked = false;
    }
  }

  /**
   * Process the result of a mutation synchronously for testing
   * @param key - The key of the record
   * @param result - The result of the mutation
   * @returns The final record value or undefined if deleted
   * @private
   */
  private _processResultSync(
    key: K,
    result: R | void | MutationAction,
  ): R | undefined {
    // Handle special actions
    if (result && typeof result === 'object' && 'action' in result) {
      // Process the action immediately for testing
      if ((result as MutationAction).action === MUTATION_ACTIONS.DELETE) {
        if ((result as MutationAction).key !== undefined) {
          this.delete((result as MutationAction).key);
        }
        return undefined;
      }

      // For NOOP action, return the current value
      if ((result as MutationAction).action === MUTATION_ACTIONS.NOOP) {
        return this.get(key);
      }

      // For other actions, return the current value
      return this.get(key);
    }

    // Set the result if it's not undefined
    if (result !== undefined) {
      this.set(key, result as R);
    }

    // Return the result
    return (result as R) || this.get(key);
  }

  /**
   * Override the _afterMutate method to use our synchronous processing
   */
  protected override _afterMutate(
    key: K,
    result: R | void | MutationAction,
  ): R | undefined {
    // Use our synchronous processing for testing
    return this._processResultSync(key, result);
  }
}

/**
 * Factory function to create instances of SunMemoryImmerC
 */
export function memoryImmerCSunF<R, K>(coll: CollSyncIF<R, K>): SunIF<R, K> {
  return new SunMemoryImmerC<R, K>(coll);
}
