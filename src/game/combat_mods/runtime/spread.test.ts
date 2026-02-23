import { describe, expect, test } from "vitest";
import { RNG } from "../../util/rng";
import { applySpreadToDirection } from "./spread";

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
