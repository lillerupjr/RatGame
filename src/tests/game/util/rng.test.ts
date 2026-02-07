// src/game/util/rng.test.ts
import { describe, it, expect } from "vitest";
import { RNG } from "../../../game/util/rng";

describe("RNG", () => {
  describe("constructor", () => {
    it("should create RNG with given seed", () => {
      const rng = new RNG(12345);
      expect(rng).toBeInstanceOf(RNG);
    });

    it("should handle zero seed by using fallback", () => {
      const rng = new RNG(0);
      // Should still produce valid numbers
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });

  describe("determinism", () => {
    it("should produce same sequence for same seed", () => {
      const rng1 = new RNG(42);
      const rng2 = new RNG(42);

      const seq1 = [rng1.next(), rng1.next(), rng1.next()];
      const seq2 = [rng2.next(), rng2.next(), rng2.next()];

      expect(seq1).toEqual(seq2);
    });

    it("should produce different sequences for different seeds", () => {
      const rng1 = new RNG(42);
      const rng2 = new RNG(43);

      const val1 = rng1.next();
      const val2 = rng2.next();

      expect(val1).not.toEqual(val2);
    });
  });

  describe("next()", () => {
    it("should return values between 0 and 1", () => {
      const rng = new RNG(12345);

      for (let i = 0; i < 100; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("range()", () => {
    it("should return values within specified range", () => {
      const rng = new RNG(12345);

      for (let i = 0; i < 100; i++) {
        const val = rng.range(10, 20);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThanOrEqual(20);
      }
    });

    it("should handle negative ranges", () => {
      const rng = new RNG(12345);

      for (let i = 0; i < 100; i++) {
        const val = rng.range(-100, -50);
        expect(val).toBeGreaterThanOrEqual(-100);
        expect(val).toBeLessThanOrEqual(-50);
      }
    });
  });

  describe("int()", () => {
    it("should return integers within specified range (inclusive)", () => {
      const rng = new RNG(12345);

      for (let i = 0; i < 100; i++) {
        const val = rng.int(1, 6);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(6);
      }
    });

    it("should eventually produce all values in range", () => {
      const rng = new RNG(12345);
      const seen = new Set<number>();

      for (let i = 0; i < 1000; i++) {
        seen.add(rng.int(1, 6));
      }

      expect(seen.size).toBe(6);
      expect(seen.has(1)).toBe(true);
      expect(seen.has(6)).toBe(true);
    });
  });
});
