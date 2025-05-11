/**
 * Utility function to delay execution to the next event loop cycle
 * Uses requestAnimationFrame, setTimeout, or setImmediate depending on environment
 *
 * @param callback - Function to execute after delay
 * @returns A promise that resolves when the callback has been executed
 */
export function delay<T>(callback: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    // Check if we're in a browser environment with requestAnimationFrame
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        resolve(callback());
      });
    }
    // Check if we're in Node.js with setImmediate
    // Use a type guard to check for setImmediate
    else if (
      typeof globalThis !== 'undefined' &&
      'setImmediate' in globalThis &&
      typeof (globalThis as any).setImmediate === 'function'
    ) {
      (globalThis as any).setImmediate(() => {
        resolve(callback());
      });
    }
    // Fallback to setTimeout(0)
    else {
      setTimeout(() => {
        resolve(callback());
      }, 0);
    }
  });
}

/**
 * Utility function to delay execution by a specified number of milliseconds
 *
 * @param ms - Number of milliseconds to delay
 * @returns A promise that resolves after the specified delay
 */
export function delayMs(ms: number = 0): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/**
 * Utility function to delay execution to the next event loop cycle
 * and then execute a callback with the provided value
 *
 * @param value - Value to pass to the callback
 * @param callback - Function to execute with the value
 * @returns A promise that resolves to the result of the callback
 */
export function delayWith<T, R>(
  value: T,
  callback: (value: T) => R,
): Promise<R> {
  return delay(() => callback(value));
}
