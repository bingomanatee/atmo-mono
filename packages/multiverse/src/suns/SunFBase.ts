import { get } from 'lodash-es';
import { isColl, isObj } from '../typeguards.multiverse';
import type { CollIF } from '../types.coll';
import type { FieldLocalIF, SunIF } from '../types.multiverse';
import { validateField } from '../utils/validateField';

/**
 * Simple delay function for testing
 * @param callback - Function to execute after delay
 * @returns Promise that resolves with the result of the callback
 */
const delay = <T>(callback: () => T): Promise<T> => {
  return new Promise<T>((resolve) => {
    setTimeout(() => {
      resolve(callback());
    }, 0);
  });
};

export abstract class SunBase<
  RecordType,
  KeyType,
  CollType extends CollIF<RecordType, KeyType> = CollIF<RecordType, KeyType>,
> implements SunIF<RecordType, KeyType>
{
  #coll?: CollType;
  protected _isMutating: boolean = false;
  #initialized: boolean = false;

  get coll(): CollType {
    if (!this.#coll) {
      throw new Error('Collection is not set');
    }
    if (!this.#initialized) {
      throw new Error('Sun must be initialized before accessing collection');
    }
    return this.#coll;
  }

  set coll(value: CollType) {
    this.#coll = value;
  }

  init(coll?: CollType): void {
    if (coll) {
      this.#coll = coll;
    }
    if (this.#initialized) {
      return;
    }

    if (!this.#coll) {
      throw new Error('Collection must be set before initialization');
    }
    if (!isColl(this.#coll)) {
      console.error('Invalid collection passed to SunBase:', this.#coll);
      throw new Error('Collection must be a valid collection');
    }
    if (!this.#coll.schema) {
      throw new Error('Collection schema must be set before initialization');
    }
    // Call subclass-specific initialization
    this._init();
    this.#initialized = true;
  }

  /**
   * Subclass-specific initialization. Called after base validation but before setting initialized flag.
   * Override this method to add initialization logic specific to your Sun implementation.
   */
  protected _init(): void {
    // Default implementation does nothing
  }

  /**
   * Event queue for handling asynchronous events
   * @protected
   */
  protected _eventQueue: Array<() => void> = [];

  /**
   * Flag to indicate if the collection is locked
   * @protected
   */
  protected _locked: boolean = false;

  /**
   * Flag to indicate if the event queue is being processed
   * @protected
   */
  protected _processingEvents: boolean = false;

  /**
   * Queue an event to be processed
   * @param event - Function to execute
   * @protected
   */
  protected _queueEvent(event: () => void): void {
    // Add the event to the queue
    this._eventQueue.push(event);

    // If not already processing events, start processing
    if (!this._processingEvents) {
      this._processEvents();
    }
  }

  /**
   * Process events in the queue
   * @protected
   */
  protected async _processEvents(): Promise<void> {
    // Set the processing flag
    this._processingEvents = true;

    // Process all events in the queue
    while (this._eventQueue.length > 0) {
      // Get the next event
      const event = this._eventQueue.shift();

      if (event) {
        try {
          // Execute the event in the next tick
          await delay(() => {
            try {
              event();
            } catch (error) {
              console.error('Error executing event:', error);
            }
          });
        } catch (error) {
          console.error('Error in event processing delay:', error);
        }
      }
    }

    // Clear the processing flag
    this._processingEvents = false;
  }

  protected eachField(
    callback: (field: FieldLocalIF, ...rest: any[]) => void,
    ...args: any[]
  ) {
    for (const fieldName in this.coll.schema.fields) {
      const field = this.coll.schema.fields[fieldName];
      callback(field, fieldName, ...args);
    }
  }

  validate(input: any) {
    if (isObj(input)) {
      const inputObj = input as Record<string, any>;
      try {
        this.eachField((field, fieldName) => {
          if (field.meta?.optional && inputObj[fieldName] === undefined) {
            return;
          }

          const value = get(input, fieldName);

          const result = validateField(
            value,
            fieldName,
            this.coll.schema,
            input,
          );
          if (result) {
            throw new Error(`\`validation error: ${fieldName}, ${result}`);
          }
        });
      } catch (err) {
        if (false)
          console.error(
            'SunFBase validation error:',
            input,
            err.message,
            'for schema',
            this.coll.schema,
            'of',
            this.coll.name,
          );
        throw err;
      }
    }
  }

  /**
   * Iterate over each record in the collection
   * @param callback - Function to call for each record
   * @returns void for sync collections, Promise<void> for async collections
   */
  abstract each(
    callback: (record: RecordType, key: KeyType, collection: CollType) => void,
  ): void | Promise<void>;

  /**
   * Get the number of records in the collection
   * @returns The number of records for sync collections, Promise<number> for async collections
   */
  abstract count(): number | Promise<number>;
}
