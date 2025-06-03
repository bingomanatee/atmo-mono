import { Subject } from 'rxjs';
import { isColl } from '../typeguards.multiverse';
import type { CollIF } from '../types.coll';
import { SunBase } from './SunFBase';

/**
 * Base class for Sun implementations that use an event system
 * Provides common event handling functionality to reduce redundancy
 */
export abstract class SunEventBase<
  R,
  K,
  C extends CollIF<R, K>,
> extends SunBase<R, K, C> {
  /**
   * Event subject for handling asynchronous events
   * @protected
   */
  protected _event$: Subject<() => void> = new Subject<() => void>();

  /**
   * Flag to indicate if the collection is locked
   * @protected
   */
  protected _locked: boolean = false;

  constructor(coll: C) {
    super();
    if (!isColl(coll)) {
      throw new Error(
        'SunEventBase: coll is required and must be a valid collection',
      );
    }
    this.coll = coll;

    // Subscribe to the event subject to process events
    this._event$.subscribe({
      next: (event) => {
        // Use delay to ensure events are processed in the next tick
        this._delay(() => {
          try {
            // Execute the event
            event();
          } catch (error) {
            console.error('Error processing event:', error);
          }
        }).catch((error) => {
          console.error('Error in event processing delay:', error);
        });
      },
      error: (error) => {
        // This should never be called, but just in case
        console.error('Unexpected error in event subject:', error);

        // Create a new Subject to replace the completed one
        this._event$ = new Subject<() => void>();
      },
    });
  }

  /**
   * Queue an event to be processed
   * @param event - Function to execute
   * @protected
   */
  protected _queueEvent(event: () => void): void {
    // Emit the event to the subject
    try {
      this._event$.next(event);
    } catch (error) {
      console.error('Error queueing event:', error);

      // If the subject is in an error state, create a new one
      this._event$ = new Subject<() => void>();

      // Try again with the new subject
      this._event$.next(event);
    }
  }

  /**
   * Simple delay function for testing
   * @param callback - Function to execute after delay
   * @returns Promise that resolves with the result of the callback
   * @protected
   */
  protected _delay<T>(callback: () => T): Promise<T> {
    return new Promise<T>((resolve) => {
      setTimeout(() => {
        resolve(callback());
      }, 0);
    });
  }
}
