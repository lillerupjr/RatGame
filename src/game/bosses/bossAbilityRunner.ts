import { emitEvent, type World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { getUserSettings } from "../../userSettings";
import { makeEnemyHitMeta } from "../combat/damageMeta";
import { getEnemyAimWorld, getPlayerAimWorld } from "../combat/aimPoints";
import { getPlayerWorld } from "../coords/worldViews";
import { worldToTile } from "../map/compile/kenneyMap";
import { breakMomentumOnLifeDamage } from "../systems/sim/momentum";
import { applyPlayerIncomingDamage } from "../systems/sim/playerArmor";
import { beamIntersectsCircle, resolveClampedBeamGeometry } from "../systems/sim/beamShared";
import { VFX_CLIP_INDEX } from "../content/vfxRegistry";
import { bossRegistry } from "./bossRegistry";
import type {
  BossAbilityDefinition,
  BossAbilityId,
  BossAbilityPhase,
  BossAnimationHookSet,
  BossCheckerboardIgnitionAbilityDefinition,
  BossPoisonFlamethrowerAbilityDefinition,
  BossToxicDropMarkerAbilityDefinition,
} from "./bossAbilities";
import { removeArenaTileEffectsByIds } from "./arenaTileEffects";
import { buildBossArena } from "./bossArena";
import {
  clearBossArenaSequence,
  createBossArenaSequenceRuntime,
  syncBossArenaSequence,
} from "./bossArenaActions";
import type { BossArenaSequenceRuntimeState } from "./bossArenaTypes";
import {
  getBossDefinitionForEntity,
  getBossEncounter,
  getBossEncounterForEntity,
} from "./bossRuntime";
import type {
  BossAnimationRequest,
  BossBeamRuntimeState,
  BossBurstSequenceRuntimeState,
  BossCastRuntimeState,
  BossEncounterState,
  BossWorldEffect,
} from "./bossTypes";

type BossHandlerContext<TAbility extends BossAbilityDefinition = BossAbilityDefinition> = {
  world: World;
  encounter: BossEncounterState;
  enemyIndex: number;
  ability: TAbility;
  cast: BossCastRuntimeState;
};

type BossAbilityHandler<TAbility extends BossAbilityDefinition = BossAbilityDefinition> = {
  onTelegraphStart?(ctx: BossHandlerContext<TAbility>): void;
  onActiveStart?(ctx: BossHandlerContext<TAbility>): void;
  onActiveStep?(ctx: BossHandlerContext<TAbility>, dt: number): void;
  onResolveStart?(ctx: BossHandlerContext<TAbility>): void;
  onCleanup?(ctx: BossHandlerContext<TAbility>): void;
};

const CHEM_GUY_POISON_RAIN_VFX_ID = "CHEM_GUY_POISON_RAIN";
const CHEM_GUY_TOXIC_MARKER_TELEGRAPH_SPRITE_ID = "vfx/icons/radioactive";

function phaseDurationForAbility(ability: BossAbilityDefinition, phase: BossAbilityPhase): number {
  switch (phase) {
    case "TELEGRAPH":
      return Math.max(0, ability.telegraphSec);
    case "ACTIVE":
      return Math.max(0, ability.activeSec);
    case "RESOLVE":
      return Math.max(0, ability.resolveSec);
    case "COOLDOWN":
      return Math.max(0, ability.cooldownSec);
  }
  return 0;
}

function animationRequestForPhase(
  world: World,
  enemyIndex: number,
  hooks: BossAnimationHookSet | undefined,
  ability: BossAbilityDefinition,
  phase: BossAbilityPhase,
): BossAnimationRequest | null {
  const bossDef = getBossDefinitionForEntity(world, enemyIndex);
  const castAnim = bossDef?.presentation?.sprite?.castAnim;
  const shouldUseBossCastAnim =
    !!castAnim
    && (
      (phase === "TELEGRAPH" && ability.telegraphSec > 0)
      || (phase === "ACTIVE" && ability.telegraphSec <= 0)
    );
  const clip = shouldUseBossCastAnim
    ? castAnim
    : phase === "TELEGRAPH"
      ? hooks?.castStart
      : phase === "ACTIVE"
        ? hooks?.loop
        : phase === "RESOLVE"
          ? hooks?.resolve
          : undefined;
  if (!clip) return null;
  const durationSec = shouldUseBossCastAnim
    ? Math.max(0.0001, phase === "TELEGRAPH" ? ability.telegraphSec : ability.activeSec)
    : undefined;
  return {
    clip,
    loop: shouldUseBossCastAnim ? false : phase === "ACTIVE",
    startedAtSec: world.timeSec ?? world.time ?? 0,
    durationSec,
  };
}

function getBossDamageScale(world: World, enemyIndex: number): number {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  if (!boss) return 1;
  const baseDamage = Math.max(1, boss.stats.contactDamage);
  const runtimeDamage = Math.max(0, world.eDamage?.[enemyIndex] ?? boss.stats.contactDamage);
  return runtimeDamage / baseDamage;
}

function getBossOriginZ(world: World, enemyIndex: number): number {
  return world.ezVisual?.[enemyIndex] ?? 0;
}

function buildPoisonFlamethrowerRuntimeState(
  world: World,
  ability: BossPoisonFlamethrowerAbilityDefinition,
  enemyIndex: number,
): {
  targetWorld: { x: number; y: number };
  beam: BossBeamRuntimeState;
} {
  const originWorld = getEnemyAimWorld(world, enemyIndex);
  const playerAimWorld = getPlayerAimWorld(world);
  const fallbackDirX = world.eFaceX?.[enemyIndex] ?? 1;
  const fallbackDirY = world.eFaceY?.[enemyIndex] ?? 0;
  const beamGeometry = resolveClampedBeamGeometry(world, {
    originX: originWorld.x,
    originY: originWorld.y,
    originZ: getBossOriginZ(world, enemyIndex),
    dirX: playerAimWorld.x - originWorld.x,
    dirY: playerAimWorld.y - originWorld.y,
    maxRangePx: ability.maxRangePx,
    widthPx: ability.widthPx,
    fallbackDirX,
    fallbackDirY,
  });
  const loopClipId = VFX_CLIP_INDEX[ability.loopVfxId];
  const endingClipId = VFX_CLIP_INDEX[ability.endingVfxId];
  if (!Number.isFinite(loopClipId)) {
    throw new Error(`Unknown boss beam loop VFX clip: ${ability.loopVfxId}`);
  }
  if (!Number.isFinite(endingClipId)) {
    throw new Error(`Unknown boss beam ending VFX clip: ${ability.endingVfxId}`);
  }
  world.eFaceX[enemyIndex] = beamGeometry.dirX;
  world.eFaceY[enemyIndex] = beamGeometry.dirY;
  return {
    targetWorld: playerAimWorld,
    beam: {
      lockedDirX: beamGeometry.dirX,
      lockedDirY: beamGeometry.dirY,
      startWorldX: beamGeometry.originX,
      startWorldY: beamGeometry.originY,
      endWorldX: beamGeometry.endX,
      endWorldY: beamGeometry.endY,
      maxRangePx: ability.maxRangePx,
      widthPx: ability.widthPx,
      visualScale: Math.max(0.1, ability.visualScale),
      damagePerTick: Math.max(0, ability.damagePerTick),
      tickEverySec: Math.max(0.01, ability.tickEverySec),
      tickLeftSec: Math.max(0.01, ability.tickEverySec),
      loopClipId,
      endingClipId,
    },
  };
}

function getPlayerTargetTile(world: World): { tx: number; ty: number } {
  const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const playerTile = worldToTile(playerWorld.wx, playerWorld.wy, KENNEY_TILE_WORLD);
  return { tx: playerTile.tx, ty: playerTile.ty };
}

function setCastTargetTile(
  cast: BossCastRuntimeState,
  tile: { tx: number; ty: number },
): void {
  cast.selectedTiles = [{ tx: tile.tx, ty: tile.ty }];
  cast.targetTile = { tx: tile.tx, ty: tile.ty };
  cast.targetWorld = {
    x: (tile.tx + 0.5) * KENNEY_TILE_WORLD,
    y: (tile.ty + 0.5) * KENNEY_TILE_WORLD,
  };
}

function makeToxicTelegraphEffect(
  cast: BossCastRuntimeState,
  tile: { tx: number; ty: number },
): BossWorldEffect {
  return {
    id: `${cast.castId}_TOXIC_TELEGRAPH_${tile.tx}_${tile.ty}`,
    spriteId: CHEM_GUY_TOXIC_MARKER_TELEGRAPH_SPRITE_ID,
    worldX: (tile.tx + 0.5) * KENNEY_TILE_WORLD,
    worldY: (tile.ty + 0.5) * KENNEY_TILE_WORLD,
    projectionMode: "ground_iso",
    tileTx: tile.tx,
    tileTy: tile.ty,
    baseScale: 0.9,
    alpha: 0.95,
  };
}

function applyToxicExplosionAtTile(
  world: World,
  enemyIndex: number,
  ability: BossToxicDropMarkerAbilityDefinition,
  tile: { tx: number; ty: number },
): void {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  if (!boss) return;
  const worldX = (tile.tx + 0.5) * KENNEY_TILE_WORLD;
  const worldY = (tile.ty + 0.5) * KENNEY_TILE_WORLD;
  emitEvent(world, {
    type: "VFX",
    id: CHEM_GUY_POISON_RAIN_VFX_ID,
    x: worldX,
    y: worldY,
    scale: 4,
  });

  const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const playerTile = worldToTile(playerWorld.wx, playerWorld.wy, KENNEY_TILE_WORLD);
  if (playerTile.tx !== tile.tx || playerTile.ty !== tile.ty) return;

  const damageScale = getBossDamageScale(world, enemyIndex);
  const scaledDamage = Math.max(0, Math.round(ability.damage * damageScale));
  const godMode = !!getUserSettings().debug.godMode;
  const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(world, scaledDamage);
  if (!godMode) world.playerHp -= lifeDamage;
  if (lifeDamage > 0) {
    breakMomentumOnLifeDamage(world, world.timeSec ?? world.time ?? 0);
  }
  emitEvent(world, {
    type: "PLAYER_HIT",
    damage: lifeDamage,
    x: worldX,
    y: worldY,
    damageMeta: makeEnemyHitMeta(boss.id, ability.attackId, {
      category: "HIT",
      mode: "INTRINSIC",
      instigatorId: String(enemyIndex),
      isProcDamage: false,
    }),
  });
}

function processToxicBurstTimeline(
  world: World,
  enemyIndex: number,
  ability: BossToxicDropMarkerAbilityDefinition,
  cast: BossCastRuntimeState,
  dt: number,
): void {
  const sequence = cast.burstSequence;
  if (!sequence || !(dt > 0)) return;
  let windowStart = cast.phaseElapsedSec;
  const windowEnd = windowStart + dt;

  while (true) {
    let nextTime = Number.POSITIVE_INFINITY;
    let nextAction: "telegraph" | "explode" | null = null;

    if (sequence.burstsTelegraphed < sequence.burstCount) {
      const telegraphAtSec =
        sequence.burstsTelegraphed * sequence.burstSpacingSec - sequence.telegraphLeadSec;
      if (telegraphAtSec > windowStart + 1e-9 && telegraphAtSec <= windowEnd + 1e-9) {
        nextTime = telegraphAtSec;
        nextAction = "telegraph";
      }
    }

    if (sequence.burstsExploded < sequence.burstCount) {
      const explodeAtSec = sequence.burstsExploded * sequence.burstSpacingSec;
      if (
        explodeAtSec > windowStart + 1e-9
        && explodeAtSec <= windowEnd + 1e-9
        && explodeAtSec < nextTime
      ) {
        nextTime = explodeAtSec;
        nextAction = "explode";
      }
    }

    if (!nextAction) break;
    windowStart = nextTime;

    if (nextAction === "telegraph") {
      const tile = getPlayerTargetTile(world);
      sequence.burstTiles[sequence.burstsTelegraphed] = { tx: tile.tx, ty: tile.ty };
      sequence.burstsTelegraphed += 1;
      setCastTargetTile(cast, tile);
      replaceCastWorldEffect(cast, makeToxicTelegraphEffect(cast, tile));
      continue;
    }

    const tile = sequence.burstTiles[sequence.burstsExploded] ?? getPlayerTargetTile(world);
    setCastTargetTile(cast, tile);
    replaceCastWorldEffect(cast, null);
    applyToxicExplosionAtTile(world, enemyIndex, ability, tile);
    sequence.burstsExploded += 1;
  }
}

function buildCastRuntimeState(
  world: World,
  ability: BossAbilityDefinition,
  enemyIndex: number,
): BossCastRuntimeState {
  const bossWorld = getEnemyAimWorld(world, enemyIndex);
  const playerWorld = getPlayerAimWorld(world);
  const playerTile = worldToTile(playerWorld.x, playerWorld.y, KENNEY_TILE_WORLD);
  let targetWorld: { x: number; y: number } | null = { x: playerWorld.x, y: playerWorld.y };
  let targetTile: { tx: number; ty: number } | null = { tx: playerTile.tx, ty: playerTile.ty };
  let selectedTiles: Array<{ tx: number; ty: number }> = [];
  let burstSequence: BossBurstSequenceRuntimeState | null = null;
  let arenaSequence: BossArenaSequenceRuntimeState | null = null;
  let beam: BossBeamRuntimeState | null = null;

  if (ability.kind === "target_cast" && ability.pattern === "toxic_drop_marker") {
    const targetTileForBurst = getPlayerTargetTile(world);
    selectedTiles = [{ tx: targetTileForBurst.tx, ty: targetTileForBurst.ty }];
    targetTile = { tx: targetTileForBurst.tx, ty: targetTileForBurst.ty };
    targetWorld = {
      x: (targetTileForBurst.tx + 0.5) * KENNEY_TILE_WORLD,
      y: (targetTileForBurst.ty + 0.5) * KENNEY_TILE_WORLD,
    };
    burstSequence = {
      burstCount: ability.burstCount,
      burstSpacingSec: ability.burstSpacingSec,
      telegraphLeadSec: ability.telegraphSec,
      burstsTelegraphed: 1,
      burstsExploded: 0,
      burstTiles: [{ tx: targetTileForBurst.tx, ty: targetTileForBurst.ty }],
    };
  } else if (ability.kind === "boss_cast" && ability.pattern === "poison_flamethrower") {
    const flamethrower = buildPoisonFlamethrowerRuntimeState(world, ability, enemyIndex);
    targetWorld = flamethrower.targetWorld;
    targetTile = null;
    beam = flamethrower.beam;
  }

  return {
    castId: `BOSS_CAST_${world.bossRuntime.nextCastSeq++}`,
    abilityId: ability.id,
    kind: ability.kind,
    phase: "TELEGRAPH",
    phaseElapsedSec: 0,
    phaseDurationSec: phaseDurationForAbility(ability, "TELEGRAPH"),
    castElapsedSec: 0,
    originWorld: { x: bossWorld.x, y: bossWorld.y },
    targetWorld,
    targetTile,
    selectedTiles,
    arenaEffectIds: [],
    arenaSequence,
    worldEffects: [],
    burstSequence,
    beam,
    animationHooks: ability.animation ?? null,
    animationRequest: animationRequestForPhase(world, enemyIndex, ability.animation, ability, "TELEGRAPH"),
  };
}

function replaceCastWorldEffect(
  cast: BossCastRuntimeState,
  effect: BossWorldEffect | BossWorldEffect[] | null,
): void {
  cast.worldEffects.length = 0;
  if (!effect) return;
  if (Array.isArray(effect)) {
    cast.worldEffects.push(...effect);
    return;
  }
  cast.worldEffects.push(effect);
}

function updatePoisonFlamethrowerGeometry(world: World, enemyIndex: number, cast: BossCastRuntimeState): void {
  if (!cast.beam) return;
  const originWorld = getEnemyAimWorld(world, enemyIndex);
  const beamGeometry = resolveClampedBeamGeometry(world, {
    originX: originWorld.x,
    originY: originWorld.y,
    originZ: getBossOriginZ(world, enemyIndex),
    dirX: cast.beam.lockedDirX,
    dirY: cast.beam.lockedDirY,
    maxRangePx: cast.beam.maxRangePx,
    widthPx: cast.beam.widthPx,
    fallbackDirX: cast.beam.lockedDirX,
    fallbackDirY: cast.beam.lockedDirY,
  });
  cast.originWorld = { x: beamGeometry.originX, y: beamGeometry.originY };
  cast.beam.startWorldX = beamGeometry.originX;
  cast.beam.startWorldY = beamGeometry.originY;
  cast.beam.endWorldX = beamGeometry.endX;
  cast.beam.endWorldY = beamGeometry.endY;
}

function applyPoisonFlamethrowerDamageTick(
  world: World,
  enemyIndex: number,
  ability: BossPoisonFlamethrowerAbilityDefinition,
  cast: BossCastRuntimeState,
): void {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  const beam = cast.beam;
  if (!boss || !beam) return;
  const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const touchesPlayer = beamIntersectsCircle(
    {
      originX: beam.startWorldX,
      originY: beam.startWorldY,
      dirX: beam.lockedDirX,
      dirY: beam.lockedDirY,
      lengthPx: Math.hypot(beam.endWorldX - beam.startWorldX, beam.endWorldY - beam.startWorldY),
      widthPx: beam.widthPx,
    },
    playerWorld.wx,
    playerWorld.wy,
    Math.max(0, world.playerR ?? 0),
  );
  if (!touchesPlayer) return;

  const damageScale = getBossDamageScale(world, enemyIndex);
  const scaledDamage = Math.max(0, Math.round(beam.damagePerTick * damageScale));
  const godMode = !!getUserSettings().debug.godMode;
  const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(world, scaledDamage);
  if (!godMode) world.playerHp -= lifeDamage;
  if (lifeDamage > 0) {
    breakMomentumOnLifeDamage(world, world.timeSec ?? world.time ?? 0);
  }
  emitEvent(world, {
    type: "PLAYER_HIT",
    damage: lifeDamage,
    x: playerWorld.wx,
    y: playerWorld.wy,
    damageMeta: makeEnemyHitMeta(boss.id, ability.attackId, {
      category: "DOT",
      mode: "INTRINSIC",
      instigatorId: String(enemyIndex),
      isProcDamage: false,
    }),
  });
}

const bossAbilityHandlers: Record<BossAbilityId, BossAbilityHandler> = {
  toxic_drop_marker: {
    onTelegraphStart: ({ cast }) => {
      const tile = cast.selectedTiles[0];
      if (!tile) return;
      replaceCastWorldEffect(cast, makeToxicTelegraphEffect(cast, tile));
    },
    onActiveStart: ({ world, enemyIndex, cast, ability }) => {
      const def = ability as BossToxicDropMarkerAbilityDefinition;
      replaceCastWorldEffect(cast, null);
      const firstTile = cast.burstSequence?.burstTiles[0] ?? cast.selectedTiles[0];
      if (!firstTile) return;
      applyToxicExplosionAtTile(world, enemyIndex, def, firstTile);
      if (cast.burstSequence) {
        cast.burstSequence.burstsExploded = 1;
      }
    },
    onActiveStep: ({ world, enemyIndex, cast, ability }, dt) => {
      processToxicBurstTimeline(world, enemyIndex, ability as BossToxicDropMarkerAbilityDefinition, cast, dt);
    },
    onResolveStart: ({ world, cast }) => {
      replaceCastWorldEffect(cast, null);
      removeArenaTileEffectsByIds(world, cast.arenaEffectIds);
    },
    onCleanup: ({ world, cast }) => {
      replaceCastWorldEffect(cast, null);
      removeArenaTileEffectsByIds(world, cast.arenaEffectIds);
    },
  },
  checkerboard_ignition: {
    onTelegraphStart: ({ world, encounter, enemyIndex, cast, ability }) => {
      const def = ability as BossCheckerboardIgnitionAbilityDefinition;
      const boss = getBossDefinitionForEntity(world, enemyIndex);
      const arena = buildBossArena(world, enemyIndex);
      const damageScale = getBossDamageScale(world, enemyIndex);
      cast.arenaSequence = createBossArenaSequenceRuntime(
        arena,
        def.patternSequence.map((spec) => ({
          ...spec,
          damagePlayer: Math.max(0, Math.round(spec.damagePlayer * damageScale)),
        })),
        boss
          ? {
            damageMeta: makeEnemyHitMeta(boss.id, def.attackId, {
              category: "DOT",
              mode: "INTRINSIC",
              instigatorId: String(enemyIndex),
              isProcDamage: false,
            }),
          }
          : undefined,
      );
      cast.targetTile = { ...arena.anchorWorldTile };
      cast.targetWorld = {
        x: (arena.anchorWorldTile.tx + 0.5) * KENNEY_TILE_WORLD,
        y: (arena.anchorWorldTile.ty + 0.5) * KENNEY_TILE_WORLD,
      };
      const current = syncBossArenaSequence(world, {
        encounterId: encounter.id,
        abilityId: def.id,
        sequence: cast.arenaSequence,
        castElapsedSec: cast.castElapsedSec,
      });
      cast.selectedTiles = current.currentTiles.map((tile) => ({ ...tile }));
    },
    onResolveStart: ({ world, cast }) => {
      clearBossArenaSequence(world, cast.arenaSequence);
      cast.arenaSequence = null;
    },
    onCleanup: ({ world, cast }) => {
      replaceCastWorldEffect(cast, null);
      clearBossArenaSequence(world, cast.arenaSequence);
      cast.arenaSequence = null;
    },
  },
  poison_flamethrower: {
    onActiveStart: ({ world, enemyIndex, cast }) => {
      updatePoisonFlamethrowerGeometry(world, enemyIndex, cast);
    },
    onActiveStep: ({ world, enemyIndex, cast, ability }, dt) => {
      const def = ability as BossPoisonFlamethrowerAbilityDefinition;
      if (!(dt > 0) || !cast.beam) return;
      updatePoisonFlamethrowerGeometry(world, enemyIndex, cast);
      cast.beam.tickLeftSec -= dt;
      while (cast.beam.tickLeftSec <= 1e-9) {
        applyPoisonFlamethrowerDamageTick(world, enemyIndex, def, cast);
        cast.beam.tickLeftSec += Math.max(0.01, cast.beam.tickEverySec);
      }
    },
  },
};

function callHandlerHook(
  hook: "onTelegraphStart" | "onActiveStart" | "onResolveStart" | "onCleanup",
  world: World,
  encounter: BossEncounterState,
  enemyIndex: number,
  ability: BossAbilityDefinition,
  cast: BossCastRuntimeState,
): void {
  const handler = bossAbilityHandlers[ability.id];
  const fn = handler?.[hook];
  if (!fn) return;
  fn({
    world,
    encounter,
    enemyIndex,
    ability: ability as never,
    cast,
  });
}

function callActiveStepHook(
  world: World,
  encounter: BossEncounterState,
  enemyIndex: number,
  ability: BossAbilityDefinition,
  cast: BossCastRuntimeState,
  dt: number,
): void {
  const handler = bossAbilityHandlers[ability.id];
  const fn = handler?.onActiveStep;
  if (!fn || !(dt > 0)) return;
  fn({
    world,
    encounter,
    enemyIndex,
    ability: ability as never,
    cast,
  }, dt);
}

export function selectAbilityForEncounter(
  world: World,
  enemyIndex: number,
): BossAbilityDefinition | null {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  const encounter = getBossEncounterForEntity(world, enemyIndex);
  if (!boss || !encounter || encounter.activeCast) return null;
  const loadout = boss.abilityLoadout;
  if (loadout.length <= 0) return null;

  const startCursor = Math.max(0, encounter.nextAbilityCursor % loadout.length);
  for (let offset = 0; offset < loadout.length; offset++) {
    const index = (startCursor + offset) % loadout.length;
    const entry = loadout[index];
    const cooldownLeft = encounter.cooldowns[entry.abilityId] ?? 0;
    if (cooldownLeft > 0) continue;
    encounter.nextAbilityCursor = (index + 1) % loadout.length;
    return bossRegistry.ability(entry.abilityId);
  }
  return null;
}

export function beginBossCast(
  world: World,
  enemyIndex: number,
  abilityId: BossAbilityId,
): BossCastRuntimeState | null {
  const encounter = getBossEncounterForEntity(world, enemyIndex);
  if (!encounter || encounter.activeCast) return null;
  const ability = bossRegistry.ability(abilityId);
  const cast = buildCastRuntimeState(world, ability, enemyIndex);
  encounter.activeCast = cast;
  encounter.requestedAnimation = cast.animationRequest;
  callHandlerHook("onTelegraphStart", world, encounter, enemyIndex, ability, cast);
  if (cast.phaseDurationSec <= 0) {
    stepBossCastPhase(world, encounter.id, enemyIndex, 0);
  }
  return encounter.activeCast;
}

function setCastPhase(
  world: World,
  encounter: BossEncounterState,
  enemyIndex: number,
  cast: BossCastRuntimeState,
  phase: BossAbilityPhase,
): void {
  const ability = bossRegistry.ability(cast.abilityId);
  cast.phase = phase;
  cast.phaseElapsedSec = 0;
  cast.phaseDurationSec = phaseDurationForAbility(ability, phase);
  cast.animationRequest = animationRequestForPhase(world, enemyIndex, cast.animationHooks ?? undefined, ability, phase);
  encounter.requestedAnimation = cast.animationRequest;

  if (phase === "ACTIVE") {
    encounter.cooldowns[cast.abilityId] = Math.max(encounter.cooldowns[cast.abilityId] ?? 0, ability.cooldownSec);
    callHandlerHook("onActiveStart", world, encounter, enemyIndex, ability, cast);
  } else if (phase === "RESOLVE") {
    callHandlerHook("onResolveStart", world, encounter, enemyIndex, ability, cast);
  }
}

export function finishBossCast(
  world: World,
  encounterId: string,
  enemyIndex: number,
): void {
  const encounter = getBossEncounter(world, encounterId);
  if (!encounter?.activeCast) return;
  const cast = encounter.activeCast;
  const ability = bossRegistry.ability(cast.abilityId);
  callHandlerHook("onCleanup", world, encounter, enemyIndex, ability, cast);
  encounter.activeCast = null;
  encounter.lastAbilityId = cast.abilityId;
  encounter.requestedAnimation = null;
}

export function enterNextBossCastPhase(
  world: World,
  encounterId: string,
  enemyIndex: number,
): void {
  const encounter = getBossEncounter(world, encounterId);
  const cast = encounter?.activeCast;
  if (!encounter || !cast) return;
  switch (cast.phase) {
    case "TELEGRAPH":
      setCastPhase(world, encounter, enemyIndex, cast, "ACTIVE");
      return;
    case "ACTIVE":
      setCastPhase(world, encounter, enemyIndex, cast, "RESOLVE");
      return;
    case "RESOLVE":
      setCastPhase(world, encounter, enemyIndex, cast, "COOLDOWN");
      return;
    case "COOLDOWN":
      finishBossCast(world, encounter.id, enemyIndex);
      return;
  }
}

export function stepBossCastPhase(
  world: World,
  encounterId: string,
  enemyIndex: number,
  dt: number,
): BossCastRuntimeState | null {
  const encounter = getBossEncounter(world, encounterId);
  if (!encounter?.activeCast) return null;

  let remaining = Math.max(0, dt);
  let guard = 0;
  while (encounter.activeCast && guard < 12) {
    const cast = encounter.activeCast;
    const ability = bossRegistry.ability(cast.abilityId);
    if (cast.phaseDurationSec <= 1e-9) {
      enterNextBossCastPhase(world, encounterId, enemyIndex);
      guard++;
      continue;
    }

    const timeLeftInPhase = Math.max(0, cast.phaseDurationSec - cast.phaseElapsedSec);
    const stepNow = remaining > 0 ? Math.min(remaining, timeLeftInPhase) : 0;
    if (cast.phase === "ACTIVE") {
      callActiveStepHook(world, encounter, enemyIndex, ability, cast, stepNow);
    }
    cast.phaseElapsedSec += stepNow;
    cast.castElapsedSec += stepNow;
    if (cast.arenaSequence) {
      const current = syncBossArenaSequence(world, {
        encounterId,
        abilityId: cast.abilityId,
        sequence: cast.arenaSequence,
        castElapsedSec: cast.castElapsedSec,
      });
      cast.selectedTiles = current.currentTiles.map((tile) => ({ ...tile }));
    }
    remaining = Math.max(0, remaining - stepNow);

    if (cast.phaseElapsedSec + 1e-9 < cast.phaseDurationSec) {
      break;
    }

    enterNextBossCastPhase(world, encounterId, enemyIndex);
    guard++;
  }
  return encounter.activeCast;
}
