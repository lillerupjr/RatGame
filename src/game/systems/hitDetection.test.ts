// src/game/systems/hitDetection.test.ts
// @ts-ignore
import { describe, it, expect } from "vitest";
import { isCircleHit, isPlayerHit, isEnemyInCircle } from "./hitDetection";
import type { World } from "../world";

function createMockWorld(overrides: Partial<World> = {}): World {
  const w = {
    px: 0,
    py: 0,
    ex: [100],
    ey: [0],
    eR: [10],
    prIsmelee: [false],
    prDirX: [1],
    prDirY: [0],
    prCone: [Math.PI / 6],
    prMeleeRange: [50],
    prR: [5],
    ...overrides,
  } as World;

  // Milestone C: provide Z buffers for contact hit tests
  (w as any).pzVisual ??= 0;
  (w as any).ezVisual ??= [0];

  return w;
}


describe("hitDetection", () => {
  describe("isCircleHit", () => {
    it("should return true when circles overlap", () => {
      // Two circles at distance 5 with combined radius 10
      expect(isCircleHit(5, 0, 10)).toBe(true);
    });

    it("should return true when circles touch exactly", () => {
      // Circles at distance 10 with combined radius 10
      expect(isCircleHit(10, 0, 10)).toBe(true);
    });

    it("should return false when circles don't overlap", () => {
      // Circles at distance 15 with combined radius 10
      expect(isCircleHit(15, 0, 10)).toBe(false);
    });

    it("should handle diagonal distances correctly", () => {
      // Distance is sqrt(3^2 + 4^2) = 5, combined radius is 6
      expect(isCircleHit(3, 4, 6)).toBe(true);
      // Distance is 5, combined radius is 4
      expect(isCircleHit(3, 4, 4)).toBe(false);
    });

    it("should return true when circles are at same position", () => {
      expect(isCircleHit(0, 0, 10)).toBe(true);
    });
  });

  describe("isPlayerHit", () => {
    it("should detect collision when enemy overlaps player", () => {
      const w = createMockWorld({
        px: 0,
        py: 0,
        ex: [15], // Enemy at x=15
        ey: [0],
        eR: [10], // Enemy radius 10
      });

      // Player radius 10, enemy at 15 with radius 10
      // Distance = 15, combined radius = 20, so they overlap
      expect(isPlayerHit(w, 0, 10)).toBe(true);
    });

    it("should not detect collision when enemy is on different elevation (no Z overlap)", () => {
      const w = createMockWorld({
        px: 0,
        py: 0,
        ex: [15],
        ey: [0],
        eR: [10],
      });

      // Same XY overlap would normally be true:
      // playerR=10, enemyR=10, dist=15 -> overlap in XY.
      // But different Z should block contact hit.
      (w as any).pzVisual = 0;
      (w as any).ezVisual = [10]; // enemy 10 units above

      expect(isPlayerHit(w, 0, 10)).toBe(false);
    });


    it("should work with different enemy indices", () => {
      const w = createMockWorld({
        px: 0,
        py: 0,
        ex: [100, 15, 200], // Multiple enemies
        ey: [0, 0, 0],
        eR: [10, 10, 10],
      });

      expect(isPlayerHit(w, 0, 10)).toBe(false); // First enemy far
      expect(isPlayerHit(w, 1, 10)).toBe(true);  // Second enemy close
      expect(isPlayerHit(w, 2, 10)).toBe(false); // Third enemy far
    });
  });

  describe("isEnemyInCircle", () => {
    it("should detect enemy inside circle", () => {
      const w = createMockWorld({
        ex: [50],
        ey: [50],
        eR: [10],
      });

      // Circle at (45, 50) with radius 20
      // Distance to enemy center = 5, enemy radius = 10
      // Combined = 30, distance = 5, so inside
      expect(isEnemyInCircle(w, 0, 45, 50, 20)).toBe(true);
    });

    it("should detect enemy outside circle", () => {
      const w = createMockWorld({
        ex: [100],
        ey: [100],
        eR: [10],
      });

      // Circle at (0, 0) with radius 50
      // Distance to enemy = ~141, combined radius = 60
      expect(isEnemyInCircle(w, 0, 0, 0, 50)).toBe(false);
    });

    it("should include enemy radius in calculation", () => {
      const w = createMockWorld({
        ex: [55],
        ey: [0],
        eR: [10],
      });

      // Circle at (0, 0) with radius 50
      // Distance = 55, circle radius = 50, enemy radius = 10
      // 50 + 10 = 60 > 55, so should be inside
      expect(isEnemyInCircle(w, 0, 0, 0, 50)).toBe(true);
    });
  });
});
