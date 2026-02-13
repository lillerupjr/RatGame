import { describe, expect, it } from "vitest";
import { getRenderableSpriteIds, isKnownRenderableSpriteId } from "../../../../engine/render/sprites/spriteIdRegistry";

describe("spriteIdRegistry", () => {
  it("contains sprite IDs sourced from map skins, structure skins, and props", () => {
    const ids = getRenderableSpriteIds();

    expect(ids.has("tiles/floor/top/stone")).toBe(true);
    expect(ids.has("structures/buildings/avenue/1")).toBe(true);
    expect(ids.has("structures/containers/container_base")).toBe(true);
    expect(ids.has("props/boats/boat1_e")).toBe(true);
  });

  it("rejects arbitrary sprite paths", () => {
    expect(isKnownRenderableSpriteId("structures/random/not_allowed")).toBe(false);
    expect(isKnownRenderableSpriteId("../../assets/anything")).toBe(false);
  });
});
