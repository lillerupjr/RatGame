// src/game/systems/hitDetection.test.ts
// @ts-ignore
import { describe, it, expect } from "vitest";
import { isCircleHit, isPlayerHit, isEnemyInCircle } from "./hitDetection";
import type { World } from "../world";
import { worldToGrid } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

function worldToAnchor(wx: number, wy: number) {
  const gp = worldToGrid(wx, wy, KENNEY_TILE_WORLD);
  const gxi = Math.floor(gp.gx);
  const gyi = Math.floor(gp.gy);
  return { gxi, gyi, gox: gp.gx - gxi, goy: gp.gy - gyi };
}

function setPlayerWorld(w: World, wx: number, wy: number) {
  const a = worldToAnchor(wx, wy);
  w.pgxi = a.gxi;
  w.pgyi = a.gyi;
  w.pgox = a.gox;
  w.pgoy = a.goy;
}

function ensureEnemyIndex(w: World, i: number) {
  while (w.egxi.length <= i) w.egxi.push(0);
  while (w.egyi.length <= i) w.egyi.push(0);
  while (w.egox.length <= i) w.egox.push(0);
  while (w.egoy.length <= i) w.egoy.push(0);
  while (w.eR.length <= i) w.eR.push(0);
}

function setEnemyWorld(w: World, i: number, wx: number, wy: number) {
  ensureEnemyIndex(w, i);
  const a = worldToAnchor(wx, wy);
  w.egxi[i] = a.gxi;
  w.egyi[i] = a.gyi;
  w.egox[i] = a.gox;
  w.egoy[i] = a.goy;
}

function createMockWorld(overrides: Partial<World> = {}): World {
  const w = {
    pgxi: 0,
    pgyi: 0,
    pgox: 0,
    pgoy: 0,
    egxi: [0],
    egyi: [0],
    egox: [0],
    egoy: [0],
    eR: [10],
    prIsmelee: [false],
    prDirX: [1],
    prDirY: [0],
    prCone: [Math.PI / 6],
    prMeleeRange: [50],
    prR: [5],
    ...overrides,
  } as World;

  setPlayerWorld(w, 0, 0);
  setEnemyWorld(w, 0, 100, 0);

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
        eR: [10], // Enemy radius 10
      });
      setPlayerWorld(w, 0, 0);
      setEnemyWorld(w, 0, 15, 0); // Enemy at x=15

      // Player radius 10, enemy at 15 with radius 10
      // Distance = 15, combined radius = 20, so they overlap
      expect(isPlayerHit(w, 0, 10)).toBe(true);
    });

    it("should not detect collision when enemy is on different elevation (no Z overlap)", () => {
      const w = createMockWorld({
        eR: [10],
      });
      setPlayerWorld(w, 0, 0);
      setEnemyWorld(w, 0, 15, 0);

      // Same XY overlap would normally be true:
      // playerR=10, enemyR=10, dist=15 -> overlap in XY.
      // But different Z should block contact hit.
      (w as any).pzVisual = 0;
      (w as any).ezVisual = [10]; // enemy 10 units above

      expect(isPlayerHit(w, 0, 10)).toBe(false);
    });


    it("should work with different enemy indices", () => {
      const w = createMockWorld({
        egxi: [0, 0, 0],
        egyi: [0, 0, 0],
        egox: [0, 0, 0],
        egoy: [0, 0, 0],
        eR: [10, 10, 10],
      });
      setPlayerWorld(w, 0, 0);
      setEnemyWorld(w, 0, 100, 0); // First enemy far
      setEnemyWorld(w, 1, 15, 0); // Second enemy close
      setEnemyWorld(w, 2, 200, 0); // Third enemy far

      expect(isPlayerHit(w, 0, 10)).toBe(false); // First enemy far
      expect(isPlayerHit(w, 1, 10)).toBe(true);  // Second enemy close
      expect(isPlayerHit(w, 2, 10)).toBe(false); // Third enemy far
    });
  });

  describe("isEnemyInCircle", () => {
    it("should detect enemy inside circle", () => {
      const w = createMockWorld({
        egxi: [0],
        egyi: [0],
        egox: [0],
        egoy: [0],
        eR: [10],
      });
      setEnemyWorld(w, 0, 50, 50);

      // Circle at (45, 50) with radius 20
      // Distance to enemy center = 5, enemy radius = 10
      // Combined = 30, distance = 5, so inside
      expect(isEnemyInCircle(w, 0, 45, 50, 20)).toBe(true);
    });

    it("should detect enemy outside circle", () => {
      const w = createMockWorld({
        egxi: [0],
        egyi: [0],
        egox: [0],
        egoy: [0],
        eR: [10],
      });
      setEnemyWorld(w, 0, 100, 100);

      // Circle at (0, 0) with radius 50
      // Distance to enemy = ~141, combined radius = 60
      expect(isEnemyInCircle(w, 0, 0, 0, 50)).toBe(false);
    });

    it("should include enemy radius in calculation", () => {
      const w = createMockWorld({
        egxi: [0],
        egyi: [0],
        egox: [0],
        egoy: [0],
        eR: [10],
      });
      setEnemyWorld(w, 0, 55, 0);

      // Circle at (0, 0) with radius 50
      // Distance = 55, circle radius = 50, enemy radius = 10
      // 50 + 10 = 60 > 55, so should be inside
      expect(isEnemyInCircle(w, 0, 0, 0, 50)).toBe(true);
    });
  });
});
