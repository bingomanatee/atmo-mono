import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import { vary, varyP, varySqP } from './vary.ts';

describe('vary function', () => {
  // Mock Math.random to return predictable values
  const originalRandom = Math.random;

  beforeEach(() => {
    // Reset Math.random to the original implementation before each test
    Math.random = originalRandom;
  });

  afterAll(() => {
    // Ensure Math.random is restored after all tests
    Math.random = originalRandom;
  });

  describe('basic variation', () => {
    it('should vary a value within the specified percentage range', () => {
      // Test with a fixed random value
      Math.random = vi.fn().mockReturnValue(0.5); // This will result in no variation

      const base = 100;
      const pct = 0.2; // 20% variation

      const result = vary(base, pct);

      // With Math.random() = 0.5, the variation factor is (0.5 * 2 - 1) = 0
      // So the result should be base * (1 + 0) = base
      expect(result).toBe(base);
    });

    it('should increase the value when random is > 0.5', () => {
      // Test with a random value that will increase the base
      Math.random = vi.fn().mockReturnValue(0.75); // This will result in positive variation

      const base = 100;
      const pct = 0.2; // 20% variation

      const result = vary(base, pct);

      // With Math.random() = 0.75, the variation factor is (0.75 * 2 - 1) = 0.5
      // So the result should be base * (1 + 0.5 * pct) = 100 * (1 + 0.1) = 110
      // Use toBeCloseTo to handle floating-point precision issues
      expect(result).toBeCloseTo(110, 10);
    });

    it('should decrease the value when random is < 0.5', () => {
      // Test with a random value that will decrease the base
      Math.random = vi.fn().mockReturnValue(0.25); // This will result in negative variation

      const base = 100;
      const pct = 0.2; // 20% variation

      const result = vary(base, pct);

      // With Math.random() = 0.25, the variation factor is (0.25 * 2 - 1) = -0.5
      // So the result should be base * (1 + (-0.5) * pct) = 100 * (1 - 0.1) = 90
      expect(result).toBe(90);
    });

    it('should respect the minimum value', () => {
      // Test with a random value that would decrease the base below the minimum
      Math.random = vi.fn().mockReturnValue(0); // This will result in maximum negative variation

      const base = 100;
      const pct = 0.3; // 30% variation
      const min = 80;

      const result = vary(base, pct, min);

      // With Math.random() = 0, the variation factor is (0 * 2 - 1) = -1
      // So the unclamped result would be base * (1 + (-1) * pct) = 100 * (1 - 0.3) = 70
      // But since min = 80, the result should be clamped to 80
      expect(result).toBe(80);
    });

    it('should respect the maximum value', () => {
      // Test with a random value that would increase the base above the maximum
      Math.random = vi.fn().mockReturnValue(1); // This will result in maximum positive variation

      const base = 100;
      const pct = 0.3; // 30% variation
      const min = 0;
      const max = 120;

      const result = vary(base, pct, min, max);

      // With Math.random() = 1, the variation factor is (1 * 2 - 1) = 1
      // So the unclamped result would be base * (1 + 1 * pct) = 100 * (1 + 0.3) = 130
      // But since max = 120, the result should be clamped to 120
      expect(result).toBe(120);
    });

    it('should handle zero base value', () => {
      const base = 0;
      const pct = 0.2; // 20% variation

      const result = vary(base, pct);

      // Any percentage of 0 is still 0
      expect(result).toBe(0);
    });

    it('should handle negative base value', () => {
      // Test with a fixed random value
      Math.random = vi.fn().mockReturnValue(0.75); // This will result in positive variation

      const base = -100;
      const pct = 0.2; // 20% variation

      const result = vary(base, pct);

      // With Math.random() = 0.75, the variation factor is (0.75 * 2 - 1) = 0.5
      // So the result should be base * (1 + 0.5 * pct) = -100 * (1 + 0.1) = -110
      // Use toBeCloseTo to handle floating-point precision issues
      expect(result).toBeCloseTo(-110, 10);
    });
  });

  describe('interpolation with variation', () => {
    it('should interpolate between min and max values when t is provided', () => {
      // Test with a fixed random value
      Math.random = vi.fn().mockReturnValue(0.5); // This will result in no variation

      const min = 10;
      const max = 20;
      const t = 0.5; // 50% interpolation
      const pct = 0.2; // 20% variation

      const result = vary(0, pct, min, max, t);

      // With t = 0.5, the base value should be min + (max - min) * t = 10 + (20 - 10) * 0.5 = 15
      // With Math.random() = 0.5, there should be no variation
      expect(result).toBe(15);
    });

    it('should apply variation to the interpolated value', () => {
      // Test with a random value that will increase the interpolated value
      Math.random = vi.fn().mockReturnValue(0.75); // This will result in positive variation

      const min = 10;
      const max = 20;
      const t = 0.5; // 50% interpolation
      const pct = 0.2; // 20% variation

      const result = vary(0, pct, min, max, t);

      // With t = 0.5, the base value should be min + (max - min) * t = 10 + (20 - 10) * 0.5 = 15
      // With Math.random() = 0.75, the variation factor is (0.75 * 2 - 1) = 0.5
      // So the result should be base + range * scale = 15 + (15 * 0.2 * 0.5) = 15 + 1.5 = 16.5
      expect(result).toBe(16.5);
    });

    it('should respect min and max bounds when interpolating', () => {
      // Test with a random value that would exceed the max
      Math.random = vi.fn().mockReturnValue(1.0); // This will result in maximum positive variation

      const min = 10;
      const max = 20;
      const t = 0.9; // 90% interpolation (base value = 19)
      const pct = 0.2; // 20% variation

      const result = vary(0, pct, min, max, t);

      // With t = 0.9, the base value should be min + (max - min) * t = 10 + (20 - 10) * 0.9 = 19
      // With Math.random() = 1.0, the variation factor is (1.0 * 2 - 1) = 1.0
      // So the unclamped result would be base + range * scale = 19 + (19 * 0.2 * 1.0) = 19 + 3.8 = 22.8
      // But since max = 20, the result should be clamped to 20
      expect(result).toBe(20);
    });

    it('should handle edge cases for t values', () => {
      // Test with t = 0 (should be equal to min)
      Math.random = vi.fn().mockReturnValue(0.5); // This will result in no variation

      const min = 10;
      const max = 20;

      const resultAtMin = vary(0, 0.2, min, max, 0);
      expect(resultAtMin).toBe(min);

      // Test with t = 1 (should be equal to max)
      const resultAtMax = vary(0, 0.2, min, max, 1);
      expect(resultAtMax).toBe(max);
    });
  });
});
