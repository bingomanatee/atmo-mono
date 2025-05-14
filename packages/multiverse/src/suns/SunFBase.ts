import { isObj } from '../typeguards.multiverse';
import type { CollBaseIF, FieldLocalIF, SunIF } from '../types.multiverse';
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
  CollType extends CollBaseIF = CollBaseIF,
> implements SunIF<RecordType, KeyType>
{
  protected coll!: CollType;

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

  protected validate(input: any) {
    if (isObj(input)) {
      const inputObj = input as Record<string, any>;
      try {
        this.eachField((field, fieldName) => {
          if (field.meta?.optional && inputObj[fieldName] === undefined) {
            return;
          }

          const result = validateField(
            inputObj[fieldName],
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
