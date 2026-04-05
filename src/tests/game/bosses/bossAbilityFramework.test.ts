import { describe, expect, it } from "vitest";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { anchorFromWorld } from "../../../game/coords/anchor";
import {
  beginBossCast,
  selectAbilityForEncounter,
  stepBossCastPhase,
} from "../../../game/bosses/bossAbilityRunner";
import { BossAbilityId } from "../../../game/bosses/bossAbilities";
import { bossRegistry } from "../../../game/bosses/bossRegistry";
import { spawnBossEncounter } from "../../../game/bosses/spawnBossEncounter";
import { BossId } from "../../../game/bosses/bossTypes";
import { bossEncounterSystem } from "../../../game/bosses/bossSystem";
import { getTrackedBossEncounterForObjective } from "../../../game/bosses/bossRuntime";
import { updateArenaTileEffects } from "../../../game/bosses/arenaTileEffects";

function createBossWorld() {
  const world = createWorld({ seed: 6601, stage: stageDocks });
  const result = spawnBossEncounter(world, {
    bossId: BossId.CHEM_GUY,
    spawnWorldX: 192,
    spawnWorldY: 192,
    objectiveId: "OBJ_ACT_BOSS",
  });
  const encounter = getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS");
  if (!encounter) {
    throw new Error("Expected spawned boss encounter");
  }
  return { world, result, encounter };
}

describe("boss ability framework", () => {
  it("registers Checkerboard Ignition on Chem Guy and alternates boss selections", () => {
    const chemGuy = bossRegistry.boss(BossId.CHEM_GUY);
    const checkerboard = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION);
    const { world, result, encounter } = createBossWorld();

    expect(chemGuy.abilityLoadout.map((entry) => entry.abilityId)).toEqual([
      BossAbilityId.TOXIC_DROP_MARKER,
      BossAbilityId.CHECKERBOARD_IGNITION,
    ]);
    expect(checkerboard).toMatchObject({
      kind: "world_cast",
      pattern: "checkerboard_ignition",
      telegraphSec: 1.0,
      activeSec: 1.5,
      resolveSec: 0.15,
      cooldownSec: 3.0,
      footprintHalfWidthTiles: 6,
      footprintHalfHeightTiles: 6,
    });
    expect(selectAbilityForEncounter(world, result.enemyIndex)?.id).toBe(BossAbilityId.TOXIC_DROP_MARKER);

    encounter.lastAbilityId = BossAbilityId.TOXIC_DROP_MARKER;

    expect(selectAbilityForEncounter(world, result.enemyIndex)?.id).toBe(BossAbilityId.CHECKERBOARD_IGNITION);
  });

  it("starts Toxic Drop Marker in TELEGRAPH with animation hooks wired", () => {
    const { world, result, encounter } = createBossWorld();

    const cast = beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);

    expect(cast).not.toBeNull();
    expect(encounter.activeCast?.phase).toBe("TELEGRAPH");
    expect(encounter.requestedAnimation).toEqual({
      clip: "cast_start",
      loop: false,
    });
    expect(world.arenaTileEffects).toHaveLength(1);
    expect(world.arenaTileEffects[0]?.state).toBe("WARNING");
  });

  it("promotes the warned tile into an active damaging hazard", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER);
    const hpBefore = world.playerHp;

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);

    expect(encounter.activeCast?.phase).toBe("TELEGRAPH");
    expect(world.arenaTileEffects[0]?.state).toBe("WARNING");

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    expect(encounter.activeCast?.phase).toBe("ACTIVE");
    expect(world.arenaTileEffects[0]?.state).toBe("ACTIVE");

    updateArenaTileEffects(world, ability.tickEverySec + 0.01);

    expect(world.playerHp).toBeLessThan(hpBefore);
  });

  it("telegraphs checkerboard tiles, activates them, and clears them", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION);
    world.rng.range = (() => 0) as typeof world.rng.range;

    beginBossCast(world, result.enemyIndex, BossAbilityId.CHECKERBOARD_IGNITION);

    expect(encounter.activeCast?.phase).toBe("TELEGRAPH");
    expect(encounter.activeCast?.selectedTiles.length ?? 0).toBeGreaterThan(20);
    expect((encounter.activeCast?.selectedTiles ?? []).every((tile) => ((tile.tx + tile.ty) & 1) === 0)).toBe(true);
    expect(world.arenaTileEffects[0]?.state).toBe("WARNING");
    expect(world.arenaTileEffects[0]?.tiles.length).toBe(encounter.activeCast?.selectedTiles.length);

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    expect(encounter.activeCast?.phase).toBe("ACTIVE");
    expect(world.arenaTileEffects[0]?.state).toBe("ACTIVE");
    expect(world.arenaTileEffects[0]?.tiles.length).toBe(encounter.activeCast?.selectedTiles.length);

    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      ability.activeSec + ability.resolveSec + ability.cooldownSec + 0.01,
    );

    expect(encounter.activeCast).toBeNull();
    expect(world.arenaTileEffects).toHaveLength(0);
    expect(encounter.lastAbilityId).toBe(BossAbilityId.CHECKERBOARD_IGNITION);
  });

  it("damages the player when standing on active checkerboard tiles", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION);
    const hpBefore = world.playerHp;
    world.rng.range = (() => 0) as typeof world.rng.range;

    beginBossCast(world, result.enemyIndex, BossAbilityId.CHECKERBOARD_IGNITION);
    const hotTile = encounter.activeCast?.selectedTiles[0];
    if (!hotTile) {
      throw new Error("Expected Checkerboard Ignition to select at least one tile");
    }

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    const playerAnchor = anchorFromWorld(
      (hotTile.tx + 0.5) * KENNEY_TILE_WORLD,
      (hotTile.ty + 0.5) * KENNEY_TILE_WORLD,
      KENNEY_TILE_WORLD,
    );
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;

    updateArenaTileEffects(world, ability.tickEverySec + 0.01);

    expect(world.arenaTileEffects[0]?.state).toBe("ACTIVE");
    expect(world.playerHp).toBeLessThan(hpBefore);
  });

  it("clears the toxic tile on resolve/cleanup", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER);

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);
    expect(world.arenaTileEffects).toHaveLength(1);

    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      ability.telegraphSec + ability.activeSec + ability.resolveSec + ability.cooldownSec + 0.01,
    );

    expect(encounter.activeCast).toBeNull();
    expect(world.arenaTileEffects).toHaveLength(0);
    expect(encounter.lastAbilityId).toBe(BossAbilityId.TOXIC_DROP_MARKER);
  });

  it("lets Toxic Drop Marker and Checkerboard Ignition coexist in the same fight", () => {
    const { world, result, encounter } = createBossWorld();
    const toxic = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER);
    const checkerboard = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION);

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);
    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      toxic.telegraphSec + toxic.activeSec + toxic.resolveSec + toxic.cooldownSec + 0.01,
    );
    expect(encounter.lastAbilityId).toBe(BossAbilityId.TOXIC_DROP_MARKER);

    expect(selectAbilityForEncounter(world, result.enemyIndex)?.id).toBe(BossAbilityId.CHECKERBOARD_IGNITION);

    beginBossCast(world, result.enemyIndex, BossAbilityId.CHECKERBOARD_IGNITION);
    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      checkerboard.telegraphSec + checkerboard.activeSec + checkerboard.resolveSec + checkerboard.cooldownSec + 0.01,
    );
    expect(encounter.lastAbilityId).toBe(BossAbilityId.CHECKERBOARD_IGNITION);
    expect(world.arenaTileEffects).toHaveLength(0);
  });

  it("does not start or advance casts while the boss is dormant", () => {
    const world = createWorld({ seed: 6602, stage: stageDocks });
    spawnBossEncounter(world, {
      bossId: BossId.CHEM_GUY,
      spawnWorldX: 640,
      spawnWorldY: 640,
      objectiveId: "OBJ_ACT_BOSS",
      activationState: "DORMANT",
    });
    const encounter = getTrackedBossEncounterForObjective(world, "OBJ_ACT_BOSS");
    if (!encounter) {
      throw new Error("Expected dormant boss encounter");
    }

    bossEncounterSystem(world, 1.0);

    expect(encounter.activationState).toBe("DORMANT");
    expect(encounter.activeCast).toBeNull();
    expect(world.arenaTileEffects).toHaveLength(0);
  });
});
