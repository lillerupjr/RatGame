import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { makeEnemyHitMeta } from "../combat/damageMeta";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";
import { worldToTile } from "../map/compile/kenneyMap";
import { bossRegistry } from "./bossRegistry";
import type {
  BossAbilityDefinition,
  BossAbilityId,
  BossCheckerboardIgnitionAbilityDefinition,
  BossAbilityPhase,
  BossAnimationHookSet,
  BossToxicDropMarkerAbilityDefinition,
} from "./bossAbilities";
import { removeArenaTileEffectsByIds, upsertArenaTileEffect } from "./arenaTileEffects";
import {
  collectBossArenaFootprintTiles,
  resolveBossArenaAnchorTile,
  selectCheckerboardTiles,
} from "./bossArenaTiles";
import {
  getBossDefinitionForEntity,
  getBossEncounter,
  getBossEncounterForEntity,
} from "./bossRuntime";
import type {
  BossAnimationRequest,
  BossCastRuntimeState,
  BossEncounterState,
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
  onResolveStart?(ctx: BossHandlerContext<TAbility>): void;
  onCleanup?(ctx: BossHandlerContext<TAbility>): void;
};

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
  hooks: BossAnimationHookSet | undefined,
  phase: BossAbilityPhase,
): BossAnimationRequest | null {
  const clip =
    phase === "TELEGRAPH"
      ? hooks?.castStart
      : phase === "ACTIVE"
        ? hooks?.loop
        : phase === "RESOLVE"
          ? hooks?.resolve
          : undefined;
  if (!clip) return null;
  return {
    clip,
    loop: phase === "ACTIVE",
  };
}

function buildCastRuntimeState(
  world: World,
  ability: BossAbilityDefinition,
  enemyIndex: number,
): BossCastRuntimeState {
  const bossWorld = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
  const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const playerTile = worldToTile(playerWorld.wx, playerWorld.wy, KENNEY_TILE_WORLD);
  let targetWorld: { x: number; y: number } | null = { x: playerWorld.wx, y: playerWorld.wy };
  let targetTile: { tx: number; ty: number } | null = { tx: playerTile.tx, ty: playerTile.ty };
  let selectedTiles: Array<{ tx: number; ty: number }> = [];

  if (ability.kind === "target_cast" && ability.pattern === "toxic_drop_marker") {
    selectedTiles = [{ tx: playerTile.tx, ty: playerTile.ty }];
  } else if (ability.kind === "world_cast" && ability.pattern === "checkerboard_ignition") {
    const arenaAnchorTile = resolveBossArenaAnchorTile(world, enemyIndex);
    const footprintTiles = collectBossArenaFootprintTiles(
      world,
      arenaAnchorTile,
      ability.footprintHalfWidthTiles,
      ability.footprintHalfHeightTiles,
    );
    const parity: 0 | 1 = world.rng.range(0, 1) < 0.5 ? 0 : 1;
    selectedTiles = selectCheckerboardTiles(footprintTiles, parity);
    targetTile = arenaAnchorTile;
    targetWorld = {
      x: (arenaAnchorTile.tx + 0.5) * KENNEY_TILE_WORLD,
      y: (arenaAnchorTile.ty + 0.5) * KENNEY_TILE_WORLD,
    };
  }

  return {
    castId: `BOSS_CAST_${world.bossRuntime.nextCastSeq++}`,
    abilityId: ability.id,
    kind: ability.kind,
    phase: "TELEGRAPH",
    phaseElapsedSec: 0,
    phaseDurationSec: phaseDurationForAbility(ability, "TELEGRAPH"),
    castElapsedSec: 0,
    originWorld: { x: bossWorld.wx, y: bossWorld.wy },
    targetWorld,
    targetTile,
    selectedTiles,
    arenaEffectIds: [],
    animationHooks: ability.animation ?? null,
    animationRequest: animationRequestForPhase(ability.animation, "TELEGRAPH"),
  };
}

function getBossDamageScale(world: World, enemyIndex: number): number {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  if (!boss) return 1;
  const baseDamage = Math.max(1, boss.stats.contactDamage);
  const runtimeDamage = Math.max(0, world.eDamage?.[enemyIndex] ?? boss.stats.contactDamage);
  return runtimeDamage / baseDamage;
}

const bossAbilityHandlers: Record<BossAbilityId, BossAbilityHandler> = {
  toxic_drop_marker: {
    onTelegraphStart: ({ world, encounter, cast, ability }) => {
      const def = ability as BossToxicDropMarkerAbilityDefinition;
      upsertArenaTileEffect(world, {
        effectIds: cast.arenaEffectIds,
        encounterId: encounter.id,
        abilityId: def.id,
        tiles: cast.selectedTiles,
        state: "WARNING",
        ttlSec: def.telegraphSec,
      });
    },
    onActiveStart: ({ world, encounter, enemyIndex, cast, ability }) => {
      const def = ability as BossToxicDropMarkerAbilityDefinition;
      const boss = getBossDefinitionForEntity(world, enemyIndex);
      if (!boss) return;
      const damageScale = getBossDamageScale(world, enemyIndex);
      const scaledDamage = Math.max(0, Math.round(def.damage * damageScale));
      upsertArenaTileEffect(world, {
        effectIds: cast.arenaEffectIds,
        encounterId: encounter.id,
        abilityId: def.id,
        tiles: cast.selectedTiles,
        state: "ACTIVE",
        ttlSec: def.activeSec,
        tickEverySec: def.tickEverySec,
        damagePlayer: scaledDamage,
        playerDamageMeta: makeEnemyHitMeta(boss.id, def.attackId, {
          category: "DOT",
          mode: "INTRINSIC",
          instigatorId: String(enemyIndex),
          isProcDamage: false,
        }),
      });
    },
    onResolveStart: ({ world, cast }) => {
      removeArenaTileEffectsByIds(world, cast.arenaEffectIds);
    },
    onCleanup: ({ world, cast }) => {
      removeArenaTileEffectsByIds(world, cast.arenaEffectIds);
    },
  },
  checkerboard_ignition: {
    onTelegraphStart: ({ world, encounter, cast, ability }) => {
      const def = ability as BossCheckerboardIgnitionAbilityDefinition;
      upsertArenaTileEffect(world, {
        effectIds: cast.arenaEffectIds,
        encounterId: encounter.id,
        abilityId: def.id,
        tiles: cast.selectedTiles,
        state: "WARNING",
        ttlSec: def.telegraphSec,
      });
    },
    onActiveStart: ({ world, encounter, enemyIndex, cast, ability }) => {
      const def = ability as BossCheckerboardIgnitionAbilityDefinition;
      const boss = getBossDefinitionForEntity(world, enemyIndex);
      if (!boss) return;
      const damageScale = getBossDamageScale(world, enemyIndex);
      const scaledDamage = Math.max(0, Math.round(def.damage * damageScale));
      upsertArenaTileEffect(world, {
        effectIds: cast.arenaEffectIds,
        encounterId: encounter.id,
        abilityId: def.id,
        tiles: cast.selectedTiles,
        state: "ACTIVE",
        ttlSec: def.activeSec,
        tickEverySec: def.tickEverySec,
        damagePlayer: scaledDamage,
        playerDamageMeta: makeEnemyHitMeta(boss.id, def.attackId, {
          category: "DOT",
          mode: "INTRINSIC",
          instigatorId: String(enemyIndex),
          isProcDamage: false,
        }),
      });
    },
    onResolveStart: ({ world, cast }) => {
      removeArenaTileEffectsByIds(world, cast.arenaEffectIds);
    },
    onCleanup: ({ world, cast }) => {
      removeArenaTileEffectsByIds(world, cast.arenaEffectIds);
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

export function selectAbilityForEncounter(
  world: World,
  enemyIndex: number,
): BossAbilityDefinition | null {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  const encounter = getBossEncounterForEntity(world, enemyIndex);
  if (!boss || !encounter || encounter.activeCast) return null;

  const available: BossAbilityDefinition[] = [];
  for (let i = 0; i < boss.abilityLoadout.length; i++) {
    const entry = boss.abilityLoadout[i];
    const cooldownLeft = encounter.cooldowns[entry.abilityId] ?? 0;
    if (cooldownLeft > 0) continue;
    available.push(bossRegistry.ability(entry.abilityId));
  }
  if (available.length <= 0) return null;
  if (available.length > 1 && encounter.lastAbilityId) {
    for (let i = 0; i < available.length; i++) {
      if (available[i]?.id !== encounter.lastAbilityId) return available[i] ?? null;
    }
  }
  return available[0] ?? null;
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
  cast.animationRequest = animationRequestForPhase(cast.animationHooks ?? undefined, phase);
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
  const cast = encounter?.activeCast;
  if (!encounter || !cast) return null;
  const step = Math.max(0, dt);
  cast.phaseElapsedSec += step;
  cast.castElapsedSec += step;
  let guard = 0;
  while (
    encounter.activeCast
    && encounter.activeCast.phaseDurationSec <= encounter.activeCast.phaseElapsedSec + 1e-9
    && guard < 8
  ) {
    const current = encounter.activeCast;
    const overflow = Math.max(0, current.phaseElapsedSec - current.phaseDurationSec);
    enterNextBossCastPhase(world, encounterId, enemyIndex);
    guard++;
    if (!encounter.activeCast) return null;
    encounter.activeCast.phaseElapsedSec += overflow;
  }
  return encounter.activeCast;
}
