import {describe, expect, it} from 'vitest';
import {Multiverse} from "./Multiverse";

describe('Multiverse', () => {
  describe('*class', () => {
    it('should have no universes by default', () => {

      const m = new Multiverse();
      expect (m.has('foo')) .toBe(false);
    });

  });

  describe('add', () => {
    it('should add a universe', () => {
      const m = new Multiverse();
      const u = {name: 'foo'};
      m.add('foo', u);
      expect(m.has('foo')).toBe(true);
      expect(m.get('foo')).toEqual(u);
    });

    it('should throw an error if universe already exists', () => {
      const m = new Multiverse();
      const u = {name: 'foo'};
      m.add('foo', u);
      expect(() => m.add('foo', u)).toThrowError(/already exists/);
    });

    it('should replace an existing universe if replace is true', () => {
      const m = new Multiverse();
      const u1 = {name: 'foo'};
      const u2 = {name: 'bar'};
      m.add('foo', u1);
      m.add('foo', u2, true);
      expect(m.get('foo')).toEqual(u2);
    });
  })
});
