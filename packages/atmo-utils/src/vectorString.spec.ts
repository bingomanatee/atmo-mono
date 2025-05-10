import { describe, expect, it } from 'vitest';
import { vectorString } from './vectcorString.ts';
import { Vector3 } from 'three';

describe('vectorString', () => {
  it('should format a value without unit as meter', () => {
    const v = new Vector3(1, 2, 4.6);
    expect(vectorString(v)).toBe('(1m, 2m, 5m)');
  });

  it('should format a  km value', () => {
    const v = new Vector3(500, 2000, 4000);
    expect(vectorString(v, 'km')).toBe('(0.5km, 2km, 4km)');
  });
  it('should format a value without unit as meter with mag', () => {
    const v = new Vector3(1, 2, 4.6);
    expect(vectorString(v, undefined, true)).toBe('(1m, 2m, 5m)-->5m');
  });

  it('should format a  km value with mag ', () => {
    const v = new Vector3(500, 2000, 4000);
    expect(vectorString(v, 'km', true)).toBe('(0.5km, 2km, 4km)-->5km');
  });
});
