/**
 * Convert any value to an Error object
 * 
 * This utility function ensures that a value is an Error object:
 * - If the value is already an Error, it is returned as is
 * - If the value is a string, it is converted to an Error with the string as the message
 * - If the value is an object with a 'message' property, it creates an Error with that message
 * - For other values, it creates an Error with a stringified version of the value
 * 
 * @param value - The value to convert to an Error
 * @param defaultMessage - Optional default message to use if the value cannot be converted
 * @returns An Error object
 */
export function asError(value: unknown, defaultMessage: string = 'Unknown error'): Error {
  // If it's already an Error, return it
  if (value instanceof Error) {
    return value;
  }
  
  // If it's a string, create an Error with the string as the message
  if (typeof value === 'string') {
    return new Error(value);
  }
  
  // If it's an object with a message property, use that
  if (value !== null && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    return new Error(value.message);
  }
  
  // For other values, try to stringify them
  try {
    const message = value === undefined ? defaultMessage : String(value);
    return new Error(message);
  } catch (e) {
    // If all else fails, return an error with the default message
    return new Error(defaultMessage);
  }
}
