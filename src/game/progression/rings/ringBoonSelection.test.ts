import { describe, expect, test } from "vitest";
import { generateBoonOptions } from "./ringBoonSelection";

function makeWorld(seed = 0) {
  let state = seed;
  return {
    rng: {
      float() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return (state >>> 0) / 0x100000000;
      },
    },
  };
}

describe("ringBoonSelection", () => {
  test("generates 3 unique boon options from family pool", () => {
    const world = makeWorld(42);
    const options = generateBoonOptions(world, "physical", [], 3);
    expect(options.length).toBe(3);
    const ids = options.map((o) => o.nodeId);
    expect(new Set(ids).size).toBe(3);
    for (const opt of options) {
      expect(opt.nodeId).toMatch(/^BOON_PHYSICAL_\d+$/);
      expect(opt.name.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
    }
  });

  test("excludes already-unlocked boon nodes", () => {
    const world = makeWorld(7);
    const options = generateBoonOptions(world, "physical", ["BOON_PHYSICAL_1", "BOON_PHYSICAL_2"], 3);
    expect(options.length).toBe(2);
    const ids = options.map((o) => o.nodeId);
    expect(ids).not.toContain("BOON_PHYSICAL_1");
    expect(ids).not.toContain("BOON_PHYSICAL_2");
  });

  test("returns empty when all boons unlocked", () => {
    const world = makeWorld(1);
    const allIds = ["BOON_PHYSICAL_1", "BOON_PHYSICAL_2", "BOON_PHYSICAL_3", "BOON_PHYSICAL_4"];
    const options = generateBoonOptions(world, "physical", allIds, 3);
    expect(options).toEqual([]);
  });

  test("returns fewer options when pool is smaller than count", () => {
    const world = makeWorld(99);
    const options = generateBoonOptions(world, "physical", ["BOON_PHYSICAL_1", "BOON_PHYSICAL_2", "BOON_PHYSICAL_3"], 3);
    expect(options.length).toBe(1);
  });

  test("returns empty for starter family (no boons)", () => {
    const world = makeWorld(5);
    const options = generateBoonOptions(world, "starter", [], 3);
    expect(options).toEqual([]);
  });
});
