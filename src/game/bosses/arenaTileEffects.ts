import { emitEvent, type World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { getPlayerWorld } from "../coords/worldViews";
import { worldToTile } from "../map/compile/kenneyMap";
import { getUserSettings } from "../../userSettings";
import { makeEnvironmentDamageMeta } from "../combat/damageMeta";
import { applyPlayerIncomingDamage } from "../systems/sim/playerArmor";
import { breakMomentumOnLifeDamage } from "../systems/sim/momentum";
import type { DamageMeta } from "../events";
import type { ArenaTileEffect, ArenaTileEffectState } from "./bossTypes";
import type { BossAbilityId } from "./bossAbilities";
import type { AnimatedSurfaceId } from "../systems/presentation/animatedSurfaces/animatedSurfaceTypes";

function createArenaTileEffect(
  world: World,
  args: {
    effectIds: string[];
    encounterId: string;
    abilityId: BossAbilityId;
    tiles: Array<{ tx: number; ty: number }>;
    state: ArenaTileEffectState;
    surfaceId?: AnimatedSurfaceId;
    renderOverlay?: boolean;
    ttlSec: number;
    tickEverySec: number;
    damagePlayer: number;
    playerDamageMeta?: DamageMeta;
  },
): void {
  const effectId = `ARENA_TILE_EFFECT_${world.bossRuntime.nextArenaEffectSeq++}`;
  args.effectIds.push(effectId);
  world.arenaTileEffects.push({
    id: effectId,
    encounterId: args.encounterId,
    abilityId: args.abilityId,
    tiles: args.tiles.map((tile) => ({ ...tile })),
    state: args.state,
    surfaceId: args.surfaceId,
    renderOverlay: args.renderOverlay ?? true,
    ttlSec: args.ttlSec,
    tickEverySec: args.tickEverySec,
    tickLeftSec: args.tickEverySec,
    damagePlayer: args.damagePlayer,
    playerDamageMeta: args.playerDamageMeta,
  });
}

export function removeArenaTileEffectsByIds(world: World, effectIds: string[]): void {
  if (effectIds.length <= 0) return;
  const effectSet = new Set(effectIds);
  world.arenaTileEffects = world.arenaTileEffects.filter((effect) => !effectSet.has(effect.id));
  effectIds.length = 0;
}

export function upsertArenaTileEffect(
  world: World,
  args: {
    effectIds: string[];
    encounterId: string;
    abilityId: BossAbilityId;
    tiles: Array<{ tx: number; ty: number }>;
    state: ArenaTileEffectState;
    surfaceId?: AnimatedSurfaceId;
    renderOverlay?: boolean;
    ttlSec: number;
    tickEverySec?: number;
    damagePlayer?: number;
    playerDamageMeta?: DamageMeta;
  },
): void {
  if (args.tiles.length <= 0) return;
  const ttlSec = Math.max(0.01, args.ttlSec);
  const tickEverySec = Math.max(0.01, args.tickEverySec ?? ttlSec);
  const damagePlayer = Math.max(0, args.damagePlayer ?? 0);
  if (args.effectIds.length <= 0) {
    createArenaTileEffect(world, {
      ...args,
      ttlSec,
      tickEverySec,
      damagePlayer,
    });
    return;
  }
  let matched = false;
  for (let i = 0; i < world.arenaTileEffects.length; i++) {
    const effect = world.arenaTileEffects[i];
    if (!args.effectIds.includes(effect.id)) continue;
    matched = true;
    effect.tiles = args.tiles.map((tile) => ({ ...tile }));
    effect.state = args.state;
    effect.surfaceId = args.surfaceId;
    effect.renderOverlay = args.renderOverlay ?? true;
    effect.ttlSec = ttlSec;
    effect.tickEverySec = tickEverySec;
    effect.tickLeftSec = tickEverySec;
    effect.damagePlayer = damagePlayer;
    effect.playerDamageMeta = args.playerDamageMeta;
  }
  if (!matched) {
    args.effectIds.length = 0;
    createArenaTileEffect(world, {
      ...args,
      ttlSec,
      tickEverySec,
      damagePlayer,
    });
  }
}

function applyArenaTileEffectToPlayer(world: World, effect: ArenaTileEffect): void {
  if (effect.state !== "ACTIVE") return;
  if (!(effect.damagePlayer > 0) || effect.tiles.length <= 0) return;
  const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const playerTile = worldToTile(playerWorld.wx, playerWorld.wy, KENNEY_TILE_WORLD);
  const standingOnEffect = effect.tiles.some((tile) => tile.tx === playerTile.tx && tile.ty === playerTile.ty);
  if (!standingOnEffect) return;

  const godMode = !!getUserSettings().debug.godMode;
  const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(world, effect.damagePlayer);
  if (!godMode) world.playerHp -= lifeDamage;
  if (lifeDamage > 0) {
    breakMomentumOnLifeDamage(world, world.timeSec ?? world.time ?? 0);
  }
  emitEvent(world, {
    type: "PLAYER_HIT",
    damage: lifeDamage,
    x: playerWorld.wx,
    y: playerWorld.wy,
    damageMeta:
      effect.playerDamageMeta
      ?? makeEnvironmentDamageMeta(`ARENA_TILE_${effect.abilityId}`, { category: "DOT", mode: "INTRINSIC" }),
  });
}

export function updateArenaTileEffects(world: World, dt: number): void {
  if (!Array.isArray(world.arenaTileEffects) || world.arenaTileEffects.length <= 0) return;
  const step = Math.max(0, dt);
  const next: ArenaTileEffect[] = [];
  for (let i = 0; i < world.arenaTileEffects.length; i++) {
    const effect = world.arenaTileEffects[i];
    const ttlSec = effect.ttlSec - step;
    if (ttlSec <= 0) continue;
    const nextEffect: ArenaTileEffect = {
      ...effect,
      ttlSec,
      tickLeftSec: effect.tickLeftSec - step,
      tiles: effect.tiles.map((tile) => ({ ...tile })),
    };
    if (nextEffect.state === "ACTIVE" && nextEffect.damagePlayer > 0) {
      while (nextEffect.tickLeftSec <= 1e-9) {
        applyArenaTileEffectToPlayer(world, nextEffect);
        nextEffect.tickLeftSec += Math.max(0.01, nextEffect.tickEverySec);
      }
    }
    next.push(nextEffect);
  }
  world.arenaTileEffects = next;
}
