/**
 * Convert a value to a string
 * @param value The value to convert
 * @param returnOnError If true, return the error message if the value cannot be serialized; if false, throw the error
 * @returns The string representation of the value
 */
export function stringify(value: any, returnOnError: boolean = false): string {
  // Handle primitive types directly
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  // Handle objects
  try {
    return JSON.stringify(value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (returnOnError) {
      return `[Unserializable Object: ${errorMessage}]`;
    } else {
      throw new Error(`Failed to serialize object: ${errorMessage}`);
    }
  }
}
