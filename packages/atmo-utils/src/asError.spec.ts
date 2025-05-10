import { describe, expect, it } from 'vitest';
import { asError } from './asError.ts';

describe('asError', () => {
  it('should return the original error if given an Error object', () => {
    const originalError = new Error('Original error');
    const result = asError(originalError);
    expect(result).toBe(originalError);
  });

  it('should convert a string to an Error with the string as the message', () => {
    const errorMessage = 'This is an error message';
    const result = asError(errorMessage);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe(errorMessage);
  });

  it('should extract the message from an object with a message property', () => {
    const errorObject = { message: 'Error from object' };
    const result = asError(errorObject);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Error from object');
  });

  it('should convert a number to an Error with the number as string in the message', () => {
    const result = asError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('42');
  });

  it('should convert null to an Error with "null" as the message', () => {
    const result = asError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('null');
  });

  it('should use the default message for undefined values', () => {
    const result = asError(undefined);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Unknown error');
  });

  it('should use a custom default message when provided', () => {
    const result = asError(undefined, 'Custom default message');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Custom default message');
  });

  it('should handle complex objects by converting them to strings', () => {
    const obj = { foo: 'bar', baz: 123 };
    const result = asError(obj);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('[object Object]');
  });
});
