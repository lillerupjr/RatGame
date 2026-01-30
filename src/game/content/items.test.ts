// src/game/content/items.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { ITEMS, MAX_ITEM_LEVEL } from "./items";
import type { World } from "../world";

// Minimal mock world for testing items
function createMockWorld(): Partial<World> {
  return {
    dmgMult: 1,
    fireRateMult: 1,
    pSpeed: 200,
    pickupRadius: 70,
    areaMult: 1,
    durationMult: 1,
    critChanceBonus: 0,
  };
}

describe("Items", () => {
  describe("DMG item", () => {
    it("should increase damage multiplier", () => {
      const w = createMockWorld() as World;
      const initialDmg = w.dmgMult;

      ITEMS.DMG.apply(w, 1);

      expect(w.dmgMult).toBeGreaterThan(initialDmg);
    });

    it("should scale with level", () => {
      const w1 = createMockWorld() as World;
      const w3 = createMockWorld() as World;

      ITEMS.DMG.apply(w1, 1);
      ITEMS.DMG.apply(w3, 3);

      expect(w3.dmgMult).toBeGreaterThan(w1.dmgMult);
    });

    it("should clamp level to max", () => {
      const wMax = createMockWorld() as World;
      const wOver = createMockWorld() as World;

      ITEMS.DMG.apply(wMax, MAX_ITEM_LEVEL);
      ITEMS.DMG.apply(wOver, MAX_ITEM_LEVEL + 10);

      expect(wOver.dmgMult).toBe(wMax.dmgMult);
    });
  });

  describe("FIRE_RATE item", () => {
    it("should increase fire rate multiplier", () => {
      const w = createMockWorld() as World;
      const initial = w.fireRateMult;

      ITEMS.FIRE_RATE.apply(w, 1);

      expect(w.fireRateMult).toBeGreaterThan(initial);
    });
  });

  describe("MOVE_SPEED item", () => {
    it("should increase player speed", () => {
      const w = createMockWorld() as World;
      const initial = w.pSpeed;

      ITEMS.MOVE_SPEED.apply(w, 1);

      expect(w.pSpeed).toBeGreaterThan(initial);
    });
  });

  describe("PICKUP_RADIUS item", () => {
    it("should increase pickup radius", () => {
      const w = createMockWorld() as World;
      const initial = w.pickupRadius;

      ITEMS.PICKUP_RADIUS.apply(w, 1);

      expect(w.pickupRadius).toBeGreaterThan(initial);
    });
  });

  describe("AREA item", () => {
    it("should increase area multiplier", () => {
      const w = createMockWorld() as World;
      const initial = w.areaMult;

      ITEMS.AREA.apply(w, 1);

      expect(w.areaMult).toBeGreaterThan(initial);
    });
  });

  describe("DURATION item", () => {
    it("should increase duration multiplier", () => {
      const w = createMockWorld() as World;
      const initial = w.durationMult;

      ITEMS.DURATION.apply(w, 1);

      expect(w.durationMult).toBeGreaterThan(initial);
    });
  });

  describe("CRIT_CHANCE item", () => {
    it("should increase crit chance bonus", () => {
      const w = createMockWorld() as World;
      const initial = w.critChanceBonus;

      ITEMS.CRIT_CHANCE.apply(w, 1);

      expect(w.critChanceBonus).toBeGreaterThan(initial);
    });

    it("should add 15% per level", () => {
      const w = createMockWorld() as World;

      ITEMS.CRIT_CHANCE.apply(w, 1);

      expect(w.critChanceBonus).toBeCloseTo(0.15, 5);
    });

    it("should stack with multiple levels", () => {
      const w = createMockWorld() as World;

      ITEMS.CRIT_CHANCE.apply(w, 3);

      expect(w.critChanceBonus).toBeCloseTo(0.45, 5);
    });
  });

  describe("all items", () => {
    it("should have required properties", () => {
      for (const [id, item] of Object.entries(ITEMS)) {
        expect(item.id).toBe(id);
        expect(typeof item.title).toBe("string");
        expect(item.title.length).toBeGreaterThan(0);
        expect(typeof item.desc).toBe("string");
        expect(item.desc.length).toBeGreaterThan(0);
        expect(typeof item.apply).toBe("function");
      }
    });
  });
});
