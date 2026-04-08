import { describe, expect, it } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import {
  clearBossArenaSequence,
  createBossArenaSequenceRuntime,
  syncBossArenaSequence,
} from "../../../game/bosses/bossArenaActions";
import { buildBossArena } from "../../../game/bosses/bossArena";
import { ArenaPatternKind } from "../../../game/bosses/bossArenaTypes";
import { updateArenaTileEffects } from "../../../game/bosses/arenaTileEffects";
import { BossAbilityId } from "../../../game/bosses/bossAbilities";
import { BossId } from "../../../game/bosses/bossTypes";
import { spawnBossEncounter } from "../../../game/bosses/spawnBossEncounter";
import { AnimatedSurfaceId } from "../../../game/content/animatedSurfaceRegistry";
import { stageDocks } from "../../../game/content/stages";
import { anchorFromWorld } from "../../../game/coords/anchor";

function createBossWorld() {
  const world = createWorld({ seed: 7711, stage: stageDocks });
  const result = spawnBossEncounter(world, {
    bossId: BossId.CHEM_GUY,
    spawnWorldX: 192,
    spawnWorldY: 192,
    objectiveId: "OBJ_ACT_BOSS",
  });
  return { world, result };
}

describe("bossArenaActions", () => {
  it("reuses an arena effect id across WARNING and ACTIVE and clears it when done", () => {
    const { world, result } = createBossWorld();
    const arena = buildBossArena(world, result.enemyIndex);
    const sequence = createBossArenaSequenceRuntime(arena, [
      {
        id: "test_checkerboard",
        patternKind: ArenaPatternKind.CHECKERBOARD,
        patternParams: { parity: 0 },
        surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
        startAtSec: 0,
        warningSec: 0.5,
        activeSec: 0.5,
        effectKind: "hazard",
        damagePlayer: 5,
        tickEverySec: 0.25,
      },
    ]);

    syncBossArenaSequence(world, {
      encounterId: "TEST",
      abilityId: BossAbilityId.CHECKERBOARD_IGNITION,
      sequence,
      castElapsedSec: 0,
    });
    const warningEffectId = world.arenaTileEffects[0]?.id;

    expect(sequence.actions[0].phase).toBe("WARNING");
    expect(world.arenaTileEffects[0]?.state).toBe("WARNING");
    expect(world.arenaTileEffects[0]?.surfaceId).toBe(AnimatedSurfaceId.TOXIC_POISON_SURFACE);
    expect(warningEffectId).toBeTruthy();

    syncBossArenaSequence(world, {
      encounterId: "TEST",
      abilityId: BossAbilityId.CHECKERBOARD_IGNITION,
      sequence,
      castElapsedSec: 0.51,
    });

    expect(sequence.actions[0].phase).toBe("ACTIVE");
    expect(world.arenaTileEffects[0]?.state).toBe("ACTIVE");
    expect(world.arenaTileEffects[0]?.surfaceId).toBe(AnimatedSurfaceId.TOXIC_POISON_SURFACE);
    expect(world.arenaTileEffects[0]?.id).toBe(warningEffectId);

    syncBossArenaSequence(world, {
      encounterId: "TEST",
      abilityId: BossAbilityId.CHECKERBOARD_IGNITION,
      sequence,
      castElapsedSec: 1.01,
    });

    expect(sequence.actions[0].phase).toBe("DONE");
    expect(world.arenaTileEffects).toHaveLength(0);
  });

  it("routes ACTIVE arena effects through the existing hazard update path", () => {
    const { world, result } = createBossWorld();
    const arena = buildBossArena(world, result.enemyIndex);
    const sequence = createBossArenaSequenceRuntime(arena, [
      {
        id: "center_blast",
        patternKind: ArenaPatternKind.CHECKERBOARD,
        patternParams: { parity: 0 },
        startAtSec: 0,
        warningSec: 0,
        activeSec: 0.5,
        effectKind: "hazard",
        damagePlayer: 5,
        tickEverySec: 0.1,
      },
    ]);
    const hpBefore = world.playerHp;

    syncBossArenaSequence(world, {
      encounterId: "TEST",
      abilityId: BossAbilityId.CHECKERBOARD_IGNITION,
      sequence,
      castElapsedSec: 0.01,
    });
    const hotTile = sequence.actions[0]?.selectedTiles[0];
    if (!hotTile) {
      throw new Error("Expected active arena action to target at least one tile");
    }
    const playerAnchor = anchorFromWorld(
      (hotTile.tx + 0.5) * KENNEY_TILE_WORLD,
      (hotTile.ty + 0.5) * KENNEY_TILE_WORLD,
      KENNEY_TILE_WORLD,
    );
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;

    updateArenaTileEffects(world, 0.11);

    expect(world.arenaTileEffects[0]?.state).toBe("ACTIVE");
    expect(world.playerHp).toBeLessThan(hpBefore);

    clearBossArenaSequence(world, sequence);
    expect(world.arenaTileEffects).toHaveLength(0);
  });
});
