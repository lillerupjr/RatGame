import { afterEach, describe, expect, it, vi } from "vitest";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { createWorld } from "../../../engine/world/world";
import { AnimatedSurfaceId } from "../../../game/content/animatedSurfaceRegistry";
import { stageDocks } from "../../../game/content/stages";
import { anchorFromWorld } from "../../../game/coords/anchor";
import {
  beginBossCast,
  selectAbilityForEncounter,
  stepBossCastPhase,
} from "../../../game/bosses/bossAbilityRunner";
import {
  BossAbilityId,
  type BossCheckerboardIgnitionAbilityDefinition,
  type BossPoisonFlamethrowerAbilityDefinition,
  type BossToxicDropMarkerAbilityDefinition,
} from "../../../game/bosses/bossAbilities";
import { bossRegistry } from "../../../game/bosses/bossRegistry";
import { spawnBossEncounter } from "../../../game/bosses/spawnBossEncounter";
import { BossId } from "../../../game/bosses/bossTypes";
import { bossEncounterSystem } from "../../../game/bosses/bossSystem";
import { getTrackedBossEncounterForObjective } from "../../../game/bosses/bossRuntime";
import { updateArenaTileEffects } from "../../../game/bosses/arenaTileEffects";
import { movementSystem } from "../../../game/systems/sim/movement";
import type { InputState } from "../../../game/systems/sim/input";
import * as authoredMapActivation from "../../../game/map/authoredMapActivation";
import { compileKenneyMapFromTable } from "../../../game/map/compile/kenneyMapLoader";

const IDLE_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  moveMag: 0,
  up: false,
  down: false,
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  interact: false,
  interactPressed: false,
};

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

function createArenaCompiledMap() {
  return compileKenneyMapFromTable({
    id: "CHEM_GUY_ARENA_TEST",
    w: 21,
    h: 21,
    cells: Array.from({ length: 21 * 21 }, (_, index) => ({
      x: index % 21,
      y: Math.floor(index / 21),
      type: "sidewalk" as const,
      z: 0,
    })),
    stamps: [{ x: 10, y: 10, type: "boss_spawn" }],
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("boss ability framework", () => {
  it("registers Chem Guy's authored ability loadout and selects from it", () => {
    const chemGuy = bossRegistry.boss(BossId.CHEM_GUY);
    const checkerboard = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION) as BossCheckerboardIgnitionAbilityDefinition;
    const flamethrower = bossRegistry.ability(BossAbilityId.POISON_FLAMETHROWER) as BossPoisonFlamethrowerAbilityDefinition;
    const { world, result } = createBossWorld();

    expect(chemGuy.abilityLoadout.map((entry) => entry.abilityId)).toEqual([
      BossAbilityId.TOXIC_DROP_MARKER,
      BossAbilityId.CHECKERBOARD_IGNITION,
      BossAbilityId.POISON_FLAMETHROWER,
    ]);
    expect(checkerboard).toMatchObject({
      kind: "world_cast",
      pattern: "checkerboard_ignition",
      telegraphSec: 0.75,
      activeSec: 7.35,
      resolveSec: 0.15,
      cooldownSec: 3.0,
      patternSequence: [
        { id: "checkerboard", startAtSec: 0, surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE },
        { id: "snake", startAtSec: 1.65, surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE },
        { id: "inward_collapse_0", startAtSec: 3.3, surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE },
        { id: "inward_collapse_1", startAtSec: 4.95, surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE },
        { id: "inward_collapse_2", startAtSec: 6.6, surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE },
      ],
    });
    expect(flamethrower).toMatchObject({
      kind: "boss_cast",
      pattern: "poison_flamethrower",
      telegraphSec: 0,
      visualScale: 5.1,
      loopVfxId: "CHEM_GUY_FLAMETHROWER_LOOP",
      endingVfxId: "CHEM_GUY_FLAMETHROWER_END",
    });
    expect(selectAbilityForEncounter(world, result.enemyIndex)?.id).toBe(BossAbilityId.TOXIC_DROP_MARKER);
  });

  it("starts Toxic Drop Marker in TELEGRAPH with animation hooks wired", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER) as BossToxicDropMarkerAbilityDefinition;

    const cast = beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);

    expect(cast).not.toBeNull();
    expect(encounter.activeCast?.phase).toBe("TELEGRAPH");
    expect(encounter.requestedAnimation).toMatchObject({
      clip: "fireball",
      loop: false,
      startedAtSec: 0,
      durationSec: ability.telegraphSec,
    });
    expect(encounter.activeCast?.worldEffects).toHaveLength(1);
    expect(encounter.activeCast?.worldEffects[0]).toMatchObject({
      spriteId: "vfx/icons/radioactive",
      worldX: (encounter.activeCast?.selectedTiles[0]?.tx! + 0.5) * KENNEY_TILE_WORLD,
      worldY: (encounter.activeCast?.selectedTiles[0]?.ty! + 0.5) * KENNEY_TILE_WORLD,
      projectionMode: "ground_iso",
    });
    expect(world.arenaTileEffects).toHaveLength(0);
  });

  it("explodes the first toxic burst for a single hit without leaving an active hazard", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER) as BossToxicDropMarkerAbilityDefinition;
    const hpBefore = world.playerHp;

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);

    expect(encounter.activeCast?.phase).toBe("TELEGRAPH");
    expect(encounter.activeCast?.worldEffects).toHaveLength(1);
    expect(world.arenaTileEffects).toHaveLength(0);

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    expect(encounter.activeCast?.phase).toBe("ACTIVE");
    expect(encounter.activeCast?.worldEffects).toHaveLength(0);
    expect(world.arenaTileEffects).toHaveLength(0);
    expect(world.playerHp).toBeLessThan(hpBefore);
    const hitEvent = world.events.find((event) => event.type === "PLAYER_HIT");
    expect(hitEvent).toMatchObject({
      type: "PLAYER_HIT",
      damage: 20,
    });
  });

  it("emits the green poison rain VFX when Toxic Drop Marker activates", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER) as BossToxicDropMarkerAbilityDefinition;

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);
    world.events.length = 0;

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    const vfxEvent = world.events.find((event) => event.type === "VFX" && event.id === "CHEM_GUY_POISON_RAIN");
    expect(vfxEvent).toMatchObject({
      type: "VFX",
      id: "CHEM_GUY_POISON_RAIN",
      scale: 4,
    });
  });

  it("retargets later toxic bursts to follow the player", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER) as BossToxicDropMarkerAbilityDefinition;

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);
    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    const secondBurstAnchor = anchorFromWorld(320, 192, KENNEY_TILE_WORLD);
    world.pgxi = secondBurstAnchor.gxi;
    world.pgyi = secondBurstAnchor.gyi;
    world.pgox = secondBurstAnchor.gox;
    world.pgoy = secondBurstAnchor.goy;

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.burstSpacingSec - ability.telegraphSec);

    expect(encounter.activeCast?.worldEffects).toHaveLength(1);
    expect(encounter.activeCast?.worldEffects[0]).toMatchObject({
      tileTx: 5,
      tileTy: 3,
      projectionMode: "ground_iso",
    });

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec);

    const thirdBurstAnchor = anchorFromWorld(320, 320, KENNEY_TILE_WORLD);
    world.pgxi = thirdBurstAnchor.gxi;
    world.pgyi = thirdBurstAnchor.gyi;
    world.pgox = thirdBurstAnchor.gox;
    world.pgoy = thirdBurstAnchor.goy;

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.burstSpacingSec - ability.telegraphSec);

    expect(encounter.activeCast?.worldEffects).toHaveLength(1);
    expect(encounter.activeCast?.worldEffects[0]).toMatchObject({
      tileTx: 5,
      tileTy: 5,
      projectionMode: "ground_iso",
    });

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec);

    const toxicBursts = world.events.filter((event) => event.type === "VFX" && event.id === "CHEM_GUY_POISON_RAIN");
    expect(toxicBursts).toHaveLength(3);
    expect(world.arenaTileEffects).toHaveLength(0);
  });

  it("runs Checkerboard Ignition as the authored arena sequence order", () => {
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(createArenaCompiledMap());
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION) as BossCheckerboardIgnitionAbilityDefinition;

    beginBossCast(world, result.enemyIndex, BossAbilityId.CHECKERBOARD_IGNITION);

    expect(encounter.activeCast?.phase).toBe("TELEGRAPH");
    expect(encounter.requestedAnimation).toMatchObject({
      clip: "fireball",
      loop: false,
      startedAtSec: 0,
      durationSec: ability.telegraphSec,
    });
    expect(encounter.activeCast?.arenaSequence?.actions.map((action) => action.spec.id)).toEqual([
      "checkerboard",
      "snake",
      "inward_collapse_0",
      "inward_collapse_1",
      "inward_collapse_2",
    ]);
    expect(encounter.activeCast?.arenaSequence?.actions.map((action) => action.phase)).toEqual([
      "WARNING",
      "PENDING",
      "PENDING",
      "PENDING",
      "PENDING",
    ]);
    expect(world.arenaTileEffects[0]?.state).toBe("WARNING");
    expect(world.arenaTileEffects[0]?.surfaceId).toBe(AnimatedSurfaceId.TOXIC_POISON_SURFACE);
    expect((encounter.activeCast?.arenaSequence?.actions[0]?.selectedCells ?? []).every((cell) => ((cell.x + cell.y) & 1) === 0)).toBe(true);

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    expect(encounter.activeCast?.phase).toBe("ACTIVE");
    expect(encounter.activeCast?.arenaSequence?.actions.map((action) => action.phase)).toEqual([
      "ACTIVE",
      "PENDING",
      "PENDING",
      "PENDING",
      "PENDING",
    ]);
    expect(world.arenaTileEffects[0]?.state).toBe("ACTIVE");
    expect(world.arenaTileEffects[0]?.surfaceId).toBe(AnimatedSurfaceId.TOXIC_POISON_SURFACE);

    stepBossCastPhase(world, encounter.id, result.enemyIndex, 0.9);

    expect(encounter.activeCast?.arenaSequence?.actions.map((action) => action.phase)).toEqual([
      "DONE",
      "WARNING",
      "PENDING",
      "PENDING",
      "PENDING",
    ]);

    stepBossCastPhase(world, encounter.id, result.enemyIndex, 1.65);

    expect(encounter.activeCast?.arenaSequence?.actions.map((action) => action.phase)).toEqual([
      "DONE",
      "DONE",
      "WARNING",
      "PENDING",
      "PENDING",
    ]);

    stepBossCastPhase(world, encounter.id, result.enemyIndex, 1.65);

    expect(encounter.activeCast?.arenaSequence?.actions.map((action) => action.phase)).toEqual([
      "DONE",
      "DONE",
      "DONE",
      "WARNING",
      "PENDING",
    ]);

    stepBossCastPhase(world, encounter.id, result.enemyIndex, 1.65);

    expect(encounter.activeCast?.arenaSequence?.actions.map((action) => action.phase)).toEqual([
      "DONE",
      "DONE",
      "DONE",
      "DONE",
      "WARNING",
    ]);

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

  it("damages the player when standing on active arena sequence tiles", () => {
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(createArenaCompiledMap());
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION) as BossCheckerboardIgnitionAbilityDefinition;
    const hpBefore = world.playerHp;

    beginBossCast(world, result.enemyIndex, BossAbilityId.CHECKERBOARD_IGNITION);
    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.telegraphSec + 0.001);

    const hotTile = encounter.activeCast?.arenaSequence?.actions[0]?.selectedTiles[0];
    if (!hotTile) {
      throw new Error("Expected Checkerboard Ignition to select at least one tile");
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

    updateArenaTileEffects(world, ability.patternSequence[0].tickEverySec + 0.01);

    expect(world.arenaTileEffects[0]?.state).toBe("ACTIVE");
    expect(world.arenaTileEffects[0]?.surfaceId).toBe(AnimatedSurfaceId.TOXIC_POISON_SURFACE);
    expect(world.playerHp).toBeLessThan(hpBefore);
  });

  it("clears the toxic tile on resolve/cleanup", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER) as BossToxicDropMarkerAbilityDefinition;

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);
    expect(encounter.activeCast?.worldEffects).toHaveLength(1);
    expect(world.arenaTileEffects).toHaveLength(0);

    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      ability.telegraphSec + ability.activeSec + ability.resolveSec + ability.cooldownSec + 0.01,
    );

    expect(encounter.activeCast).toBeNull();
    expect(world.arenaTileEffects).toHaveLength(0);
    expect(world.events.filter((event) => event.type === "VFX" && event.id === "CHEM_GUY_POISON_RAIN")).toHaveLength(3);
    expect(encounter.lastAbilityId).toBe(BossAbilityId.TOXIC_DROP_MARKER);
  });

  it("starts Poison Flamethrower immediately in ACTIVE with a locked direction", () => {
    const { world, result, encounter } = createBossWorld();
    const playerAnchor = anchorFromWorld(320, 192, KENNEY_TILE_WORLD);
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;

    const cast = beginBossCast(world, result.enemyIndex, BossAbilityId.POISON_FLAMETHROWER);

    expect(cast?.phase).toBe("ACTIVE");
    expect(cast?.beam).not.toBeNull();
    expect(encounter.requestedAnimation).toMatchObject({
      clip: "fireball",
      loop: false,
      startedAtSec: 0,
      durationSec: (bossRegistry.ability(BossAbilityId.POISON_FLAMETHROWER) as BossPoisonFlamethrowerAbilityDefinition).activeSec,
    });
    const lockedDirX = cast?.beam?.lockedDirX ?? 0;
    const lockedDirY = cast?.beam?.lockedDirY ?? 0;

    const movedPlayerAnchor = anchorFromWorld(192, 320, KENNEY_TILE_WORLD);
    world.pgxi = movedPlayerAnchor.gxi;
    world.pgyi = movedPlayerAnchor.gyi;
    world.pgox = movedPlayerAnchor.gox;
    world.pgoy = movedPlayerAnchor.goy;
    stepBossCastPhase(world, encounter.id, result.enemyIndex, 0.05);

    expect(encounter.activeCast?.phase).toBe("ACTIVE");
    expect(encounter.activeCast?.beam?.lockedDirX).toBeCloseTo(lockedDirX, 6);
    expect(encounter.activeCast?.beam?.lockedDirY).toBeCloseTo(lockedDirY, 6);
  });

  it("damages the player during active Poison Flamethrower and freezes boss movement", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.POISON_FLAMETHROWER) as BossPoisonFlamethrowerAbilityDefinition;
    const playerAnchor = anchorFromWorld(320, 192, KENNEY_TILE_WORLD);
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;
    const hpBefore = world.playerHp;
    const startX = world.egxi[result.enemyIndex] + world.egox[result.enemyIndex];
    const startY = world.egyi[result.enemyIndex] + world.egoy[result.enemyIndex];

    beginBossCast(world, result.enemyIndex, BossAbilityId.POISON_FLAMETHROWER);
    movementSystem(world, { ...IDLE_INPUT }, 0.5);
    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.tickEverySec + 0.01);

    expect(encounter.activeCast?.phase).toBe("ACTIVE");
    expect(world.egxi[result.enemyIndex] + world.egox[result.enemyIndex]).toBe(startX);
    expect(world.egyi[result.enemyIndex] + world.egoy[result.enemyIndex]).toBe(startY);
    expect(world.playerHp).toBeLessThan(hpBefore);
  });

  it("plays Poison Flamethrower resolve after the active beam and then clears it", () => {
    const { world, result, encounter } = createBossWorld();
    const ability = bossRegistry.ability(BossAbilityId.POISON_FLAMETHROWER) as BossPoisonFlamethrowerAbilityDefinition;
    const playerAnchor = anchorFromWorld(320, 192, KENNEY_TILE_WORLD);
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;

    beginBossCast(world, result.enemyIndex, BossAbilityId.POISON_FLAMETHROWER);
    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.activeSec + 0.001);

    expect(encounter.activeCast?.phase).toBe("RESOLVE");
    expect(encounter.activeCast?.beam).not.toBeNull();

    stepBossCastPhase(world, encounter.id, result.enemyIndex, ability.resolveSec + ability.cooldownSec + 0.01);

    expect(encounter.activeCast).toBeNull();
    expect(encounter.lastAbilityId).toBe(BossAbilityId.POISON_FLAMETHROWER);
  });

  it("lets Toxic Drop Marker, Checkerboard Ignition, and Poison Flamethrower execute in the same fight when invoked directly", () => {
    vi.spyOn(authoredMapActivation, "getActiveMap").mockReturnValue(createArenaCompiledMap());
    const { world, result, encounter } = createBossWorld();
    const toxic = bossRegistry.ability(BossAbilityId.TOXIC_DROP_MARKER);
    const checkerboard = bossRegistry.ability(BossAbilityId.CHECKERBOARD_IGNITION);
    const flamethrower = bossRegistry.ability(BossAbilityId.POISON_FLAMETHROWER);
    const playerAnchor = anchorFromWorld(320, 192, KENNEY_TILE_WORLD);
    world.pgxi = playerAnchor.gxi;
    world.pgyi = playerAnchor.gyi;
    world.pgox = playerAnchor.gox;
    world.pgoy = playerAnchor.goy;

    beginBossCast(world, result.enemyIndex, BossAbilityId.TOXIC_DROP_MARKER);
    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      toxic.telegraphSec + toxic.activeSec + toxic.resolveSec + toxic.cooldownSec + 0.01,
    );
    expect(encounter.lastAbilityId).toBe(BossAbilityId.TOXIC_DROP_MARKER);

    beginBossCast(world, result.enemyIndex, BossAbilityId.CHECKERBOARD_IGNITION);
    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      checkerboard.telegraphSec + checkerboard.activeSec + checkerboard.resolveSec + checkerboard.cooldownSec + 0.01,
    );
    expect(encounter.lastAbilityId).toBe(BossAbilityId.CHECKERBOARD_IGNITION);

    beginBossCast(world, result.enemyIndex, BossAbilityId.POISON_FLAMETHROWER);
    stepBossCastPhase(
      world,
      encounter.id,
      result.enemyIndex,
      flamethrower.activeSec + flamethrower.resolveSec + flamethrower.cooldownSec + 0.01,
    );
    expect(encounter.lastAbilityId).toBe(BossAbilityId.POISON_FLAMETHROWER);
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
