import { describe, expect, it } from 'vitest';
import { stringify } from './stringify.ts';

describe('stringify', () => {
  it('should handle primitive types', () => {
    expect(stringify(null)).toBe('null');
    expect(stringify(undefined)).toBe('undefined');
    expect(stringify('hello')).toBe('hello');
    expect(stringify(42)).toBe('42');
    expect(stringify(true)).toBe('true');
    expect(stringify(false)).toBe('false');
  });

  it('should handle objects', () => {
    expect(stringify({ foo: 'bar' })).toBe('{"foo":"bar"}');
    expect(stringify([1, 2, 3])).toBe('[1,2,3]');
  });

  it('should throw error for unserializable objects when returnOnError is false', () => {
    const circular: any = {};
    circular.self = circular;

    expect(() => stringify(circular, false)).toThrow(
      'Failed to serialize object',
    );
  });

  it('should return error message for unserializable objects when returnOnError is true', () => {
    const circular: any = {};
    circular.self = circular;

    const result = stringify(circular, true);
    expect(result).toContain('[Unserializable Object:');
  });
});
