import { describe, expect, it } from 'vitest';
import { isObj } from './isObj.ts';

describe('atmoUtils', () => {
  it('should identify objects', () => {
    expect(isObj({})).toBeTruthy();
    expect(isObj([])).toBeTruthy();
    expect(isObj(null)).toBeFalsy();
    expect(isObj(undefined)).toBeFalsy();
    expect(isObj(1)).toBeFalsy();
    expect(isObj('a')).toBeFalsy();
  });
});
