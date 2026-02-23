import { describe, expect, test } from "vitest";
import { RNG } from "../../util/rng";
import { applySpreadToDirection, computeProjectileAngles } from "./spread";

describe("applySpreadToDirection", () => {
  test("uses deterministic seeded offsets", () => {
    const rngA = new RNG(12345);
    const rngB = new RNG(12345);

    const offsetsA: number[] = [];
    const offsetsB: number[] = [];

    for (let i = 0; i < 8; i++) {
      offsetsA.push(applySpreadToDirection(1, 0, 6, rngA).offsetRad);
      offsetsB.push(applySpreadToDirection(1, 0, 6, rngB).offsetRad);
    }

    expect(offsetsA).toEqual(offsetsB);
  });

  test("offset stays within spread cone", () => {
    const rng = new RNG(777);
    const halfSpread = (10 * Math.PI / 180) * 0.5;

    for (let i = 0; i < 32; i++) {
      const out = applySpreadToDirection(0, 1, 10, rng);
      expect(out.offsetRad).toBeGreaterThanOrEqual(-halfSpread);
      expect(out.offsetRad).toBeLessThanOrEqual(halfSpread);
      expect(Math.hypot(out.dirX, out.dirY)).toBeCloseTo(1, 6);
    }
  });
});

describe("computeProjectileAngles", () => {
  test("n=1 returns centered single projectile", () => {
    expect(computeProjectileAngles(6, 1)).toEqual([0]);
  });

  test("n=2 returns symmetric offsets", () => {
    const out = computeProjectileAngles(10, 2);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(-out[1], 8);
  });

  test("n=3 includes center and symmetric sides", () => {
    const out = computeProjectileAngles(12, 3);
    expect(out.length).toBe(3);
    expect(out[1]).toBeCloseTo(0, 8);
    expect(out[0]).toBeCloseTo(-out[2], 8);
  });
});
