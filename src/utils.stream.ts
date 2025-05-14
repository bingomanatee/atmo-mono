/**
 * Utility functions for stream operations
 */

import { Observable, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { STREAM_ACTIONS } from './constants';

/**
 * Convert a generator to an Observable stream
 * @param generator The generator to convert
 * @param processor Optional function to process each batch before emitting
 * @returns Observable that emits processed batches and completes when the generator is done
 */
export function generatorToStream<T, R = T>(
  generator: Generator<T, void, any>,
  processor?: (batch: T) => R | Promise<R>,
): Observable<R> {
  // Create a subject to emit values
  const subject = new Subject<R>();

  // Flag to track if we should continue processing
  let isTerminated = false;

  // Process batches from the generator
  const processBatch = async () => {
    try {
      // Check if we've been terminated
      if (isTerminated) {
        return;
      }

      // Get the next batch
      const result = generator.next(
        isTerminated ? STREAM_ACTIONS.TERMINATE : undefined,
      );

      // If the generator is done, complete the subject
      if (result.done) {
        subject.complete();
        return;
      }

      // Process the batch if a processor is provided
      let processedBatch: R;
      if (processor) {
        try {
          const processed = processor(result.value);
          processedBatch =
            processed instanceof Promise ? await processed : processed;
        } catch (error) {
          // If processing fails, emit error and complete
          subject.error(error);
          return;
        }
      } else {
        // If no processor is provided, use the batch as is
        processedBatch = result.value as unknown as R;
      }

      // Emit the processed batch
      subject.next(processedBatch);

      // Schedule next batch if not terminated
      if (!isTerminated) {
        setTimeout(processBatch, 0);
      } else {
        // If terminated externally, complete the subject
        subject.complete();
      }
    } catch (error) {
      // Emit error and complete the subject
      subject.error(error);
    }
  };

  // Start processing
  processBatch();

  // Return the subject as an observable with cleanup
  return subject.asObservable().pipe(
    finalize(() => {
      // Set the termination flag
      isTerminated = true;

      // Signal the generator to terminate
      try {
        generator.next(STREAM_ACTIONS.TERMINATE);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }),
  );
}
