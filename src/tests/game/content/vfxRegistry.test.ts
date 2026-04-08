import { describe, expect, it } from "vitest";
import { VFX_CLIPS, VFX_CLIP_INDEX } from "../../../game/content/vfxRegistry";

describe("vfxRegistry", () => {
  it("derives projectile hit clips into the keyed VFX registry", () => {
    const acidIndex = VFX_CLIP_INDEX.PROJECTILE_HIT_ACID;
    const sparkIndex = VFX_CLIP_INDEX.PROJECTILE_HIT_SPARK;
    const poisonRainIndex = VFX_CLIP_INDEX.CHEM_GUY_POISON_RAIN;
    const flamethrowerLoopIndex = VFX_CLIP_INDEX.CHEM_GUY_FLAMETHROWER_LOOP;
    const flamethrowerEndIndex = VFX_CLIP_INDEX.CHEM_GUY_FLAMETHROWER_END;
    const bursterExplosionIndex = VFX_CLIP_INDEX.BURSTER_EXPLOSION;
    const onKillExplosionIndex = VFX_CLIP_INDEX.RELIC_EXPLODE_ON_KILL;
    const allHitsExplosionIndex = VFX_CLIP_INDEX.RELIC_ALL_HITS_EXPLODE;
    const bazookaExplosionIndex = VFX_CLIP_INDEX.RELIC_BAZOOKA_EXPLOSION;

    expect(acidIndex).toBeGreaterThanOrEqual(0);
    expect(sparkIndex).toBeGreaterThanOrEqual(0);
    expect(poisonRainIndex).toBeGreaterThanOrEqual(0);
    expect(flamethrowerLoopIndex).toBeGreaterThanOrEqual(0);
    expect(flamethrowerEndIndex).toBeGreaterThanOrEqual(0);
    expect(bursterExplosionIndex).toBeGreaterThanOrEqual(0);
    expect(onKillExplosionIndex).toBeGreaterThanOrEqual(0);
    expect(allHitsExplosionIndex).toBeGreaterThanOrEqual(0);
    expect(bazookaExplosionIndex).toBeGreaterThanOrEqual(0);
    expect(VFX_CLIPS[acidIndex]?.spriteIds[0]).toBe("vfx/projectiles/acid/hit/hit_01");
    expect(VFX_CLIPS[sparkIndex]?.spriteIds[0]).toBe("vfx/projectiles/lightning/hit/hit_01");
    expect(VFX_CLIPS[poisonRainIndex]?.spriteIds[0]).toBe("vfx/explosions/3_green/explosion-f1");
    expect(VFX_CLIPS[flamethrowerLoopIndex]?.spriteIds[0]).toBe("vfx/flamethrower_poison/loop/Acid VFX 02Repeatable1");
    expect(VFX_CLIPS[flamethrowerEndIndex]?.spriteIds[0]).toBe("vfx/flamethrower_poison/ending/Acid VFX 02 Ending1");
    expect(VFX_CLIPS[bursterExplosionIndex]?.spriteIds[0]).toBe("vfx/explosions/3_green/explosion-f1");
    expect(VFX_CLIPS[onKillExplosionIndex]?.spriteIds[0]).toBe("vfx/explosions/1/explosion-b1");
    expect(VFX_CLIPS[allHitsExplosionIndex]?.spriteIds[0]).toBe("vfx/explosions/3/explosion-f1");
    expect(VFX_CLIPS[bazookaExplosionIndex]?.spriteIds[0]).toBe("vfx/explosions/5/1_frame_01");
  });
});
