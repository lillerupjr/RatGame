import { describe, expect, it } from "vitest";
import { VFX_CLIPS, VFX_CLIP_INDEX } from "../../../game/content/vfxRegistry";

describe("vfxRegistry", () => {
  it("derives projectile hit clips into the keyed VFX registry", () => {
    const acidIndex = VFX_CLIP_INDEX.PROJECTILE_HIT_ACID;
    const sparkIndex = VFX_CLIP_INDEX.PROJECTILE_HIT_SPARK;

    expect(acidIndex).toBeGreaterThanOrEqual(0);
    expect(sparkIndex).toBeGreaterThanOrEqual(0);
    expect(VFX_CLIPS[acidIndex]?.spriteIds[0]).toBe("vfx/projectiles/acid/hit/hit_01");
    expect(VFX_CLIPS[sparkIndex]?.spriteIds[0]).toBe("vfx/projectiles/lightning/hit/hit_01");
  });
});
