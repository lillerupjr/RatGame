import { describe, expect, it } from "vitest";
import { isPaletteManagedSpriteId } from "../../../../engine/render/sprites/renderSprites";

describe("palette managed sprite scope", () => {
  it("includes configured managed prefixes", () => {
    expect(isPaletteManagedSpriteId("tiles/floor/sidewalk/1")).toBe(true);
    expect(isPaletteManagedSpriteId("structures/buildings/avenue/1")).toBe(true);
    expect(isPaletteManagedSpriteId("props/boats/boat1_e")).toBe(true);
    expect(isPaletteManagedSpriteId("entities/enemies/slime/rotations/south")).toBe(true);
  });

  it("excludes non-managed prefixes", () => {
    expect(isPaletteManagedSpriteId("vfx/explosion_1/1_frame_01")).toBe(false);
    expect(isPaletteManagedSpriteId("loot/gold_coin")).toBe(false);
    expect(isPaletteManagedSpriteId("ui/icons/sword")).toBe(false);
  });

  it("normalizes extension and applies legacy remap before scope check", () => {
    expect(isPaletteManagedSpriteId("tiles/floor/top/sidewalk.png")).toBe(true);
    expect(isPaletteManagedSpriteId("tiles/stairs/sidewalk_apron_1")).toBe(true);
  });
});
