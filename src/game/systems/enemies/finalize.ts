// @system   core-simulation/combat-runtime
// @owns     finalize enemy death, execute death effects, and emit kill events
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no hit detection or spawn budgeting; see hitDetection.ts and hostileSpawnDirector.ts

import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getBossDefinitionForEntity, markBossEncounterDefeated } from "../../bosses/bossRuntime";
import { isProcDamage, makeEnemyHitMeta } from "../../combat/damageMeta";
import type { EnemyId } from "../../content/enemies";
import { registry } from "../../content/registry";
import type { DamageMeta, LegacyDamageSource } from "../../events";
import { getEnemyWorld } from "../../coords/worldViews";
import { spawnEnemy } from "../../factories/enemyFactory";
import { spawnProjectile } from "../../factories/projectileFactory";
import type { HostileDeathEffectConfig } from "../../hostiles/hostileTypes";
import { walkInfo } from "../../map/compile/kenneyMap";
import { onEnemyKilledForChallenge } from "../progression/roomChallenge";
import { addMomentumOnKill } from "../sim/momentum";
import { insertEntity } from "../../util/spatialHash";
import { clearEnemyTransientState, ensureEnemyBrain, setEnemyBehaviorState } from "./brain";
import {
  resolveEnemySplitStage,
  resolveSplitterStageVisualScale,
} from "./enemyRuntime";
import { collectWorldCombatRules } from "../../progression/effects/combatRules";
import { queryCircle } from "../../util/spatialHash";
import { isEnemyInCircle } from "../sim/hitDetection";
import { makePlayerTriggerHitMeta } from "../../combat/damageMeta";
import { isLivingBombMarked, clearLivingBombMark } from "../sim/livingBomb";

const ENEMY_DEATH_PROJECTILE_RADIUS = 8;
const DEFAULT_SPLIT_SPREAD_RADIUS = 16;
const DEFAULT_SPLIT_SEPARATION_IMPULSE = 160;
const MAX_SPLIT_STEP_Z = 1.05;

function isValidSplitSpawnPosition(
  w: World,
  x: number,
  y: number,
  zHint: number | undefined,
  originInfo: ReturnType<typeof walkInfo>,
): boolean {
  const nextInfo = walkInfo(x, y, KENNEY_TILE_WORLD, zHint);
  if (!nextInfo.walkable) return false;

  const originUsesSlope = originInfo.kind === "STAIRS" || Boolean((originInfo as any).isRamp);
  const nextUsesSlope = nextInfo.kind === "STAIRS" || Boolean((nextInfo as any).isRamp);
  if (!originUsesSlope && !nextUsesSlope) {
    return nextInfo.floorH === originInfo.floorH;
  }
  return Math.abs(nextInfo.z - originInfo.z) <= MAX_SPLIT_STEP_Z;
}

function spawnSplitChildren(
  w: World,
  enemyIndex: number,
  x: number,
  y: number,
  effect: Extract<HostileDeathEffectConfig, { type: "split_into_children" }>,
): void {
  const maxSplitStage = Number.isFinite(effect.maxSplitStage)
    ? Math.max(0, Math.floor(effect.maxSplitStage))
    : 0;
  const currentStage = resolveEnemySplitStage(w, enemyIndex);
  const nextStage = currentStage + 1;
  if (nextStage > maxSplitStage) return;

  const parentType = w.eType?.[enemyIndex];
  const childType = Number.isFinite(effect.childTypeId)
    ? effect.childTypeId
    : (parentType as EnemyId | undefined);
  if (!Number.isFinite(childType)) return;

  const childDef = registry.enemy(childType as EnemyId);
  const childCount = Math.max(1, Math.floor(effect.childCount));
  const childVisualScale = resolveSplitterStageVisualScale(nextStage);
  const rewardBaseLife = Math.max(1, Math.round(childDef.stats.baseLife * childVisualScale));
  const spreadRadius = Number.isFinite(effect.spreadRadius)
    ? Math.max(0, effect.spreadRadius as number)
    : DEFAULT_SPLIT_SPREAD_RADIUS;
  const separationImpulse = Number.isFinite(effect.separationImpulse)
    ? Math.max(0, effect.separationImpulse as number)
    : DEFAULT_SPLIT_SEPARATION_IMPULSE;
  const originInfo = walkInfo(x, y, KENNEY_TILE_WORLD, w.ezVisual?.[enemyIndex]);
  const baseAngle = w.rng.range(0, Math.PI * 2);
  const faceX = w.eFaceX?.[enemyIndex] ?? 0;
  const faceY = w.eFaceY?.[enemyIndex] ?? -1;
  const zVisual = w.ezVisual?.[enemyIndex] ?? 0;
  const zLogical = w.ezLogical?.[enemyIndex] ?? 0;
  const knockVx = (((w as any)._eKnockVx ??= []) as number[]);
  const knockVy = (((w as any)._eKnockVy ??= []) as number[]);

  for (let i = 0; i < childCount; i++) {
    const angle = baseAngle + (i / childCount) * Math.PI * 2;
    let spawnX = x + Math.cos(angle) * spreadRadius;
    let spawnY = y + Math.sin(angle) * spreadRadius;
    if (!isValidSplitSpawnPosition(w, spawnX, spawnY, zVisual, originInfo)) {
      spawnX = x;
      spawnY = y;
    }

    const childIndex = spawnEnemy(w, childType as EnemyId, spawnX, spawnY, {
      splitStage: nextStage,
      visualScale: childVisualScale,
      rewardBaseLife,
    });
    w.eFaceX[childIndex] = faceX;
    w.eFaceY[childIndex] = faceY;
    w.ezVisual[childIndex] = zVisual;
    w.ezLogical[childIndex] = zLogical;
    if (separationImpulse > 0) {
      knockVx[childIndex] = (knockVx[childIndex] ?? 0) + Math.cos(angle) * separationImpulse;
      knockVy[childIndex] = (knockVy[childIndex] ?? 0) + Math.sin(angle) * separationImpulse;
    }

    const childWorld = getEnemyWorld(w, childIndex, KENNEY_TILE_WORLD);
    insertEntity(w.enemySpatialHash, childIndex, childWorld.wx, childWorld.wy, w.eR[childIndex] ?? 0);
  }
}

function executeEnemyDeathEffects(
  w: World,
  enemyIndex: number,
  x: number,
  y: number,
  sourceId: string,
  deathEffects: HostileDeathEffectConfig[],
): void {
  if (deathEffects.length <= 0) return;

  for (let effectIndex = 0; effectIndex < deathEffects.length; effectIndex++) {
    const effect = deathEffects[effectIndex];

    switch (effect.type) {
      case "radial_projectiles": {
        const count = Math.max(1, Math.floor(effect.count));
        const speed = Math.max(0, effect.speed);
        const damage = Math.max(0, effect.damage);
        const ttl = Math.max(0.05, effect.ttl);
        const damageMeta = makeEnemyHitMeta(sourceId, "DEATH_RADIAL_PROJECTILES", {
          category: "HIT",
          mode: "INTRINSIC",
          instigatorId: String(enemyIndex),
        });

        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          spawnProjectile(w, {
            kind: effect.projectileKind,
            x,
            y,
            dirX: Math.cos(angle),
            dirY: Math.sin(angle),
            speed,
            damage,
            dmgPhys: damage,
            dmgFire: 0,
            dmgChaos: 0,
            radius: ENEMY_DEATH_PROJECTILE_RADIUS,
            pierce: 0,
            maxDist: speed * ttl,
            ttl,
            hitsPlayer: true,
            noCollide: true,
            z: (w.ezVisual?.[enemyIndex] ?? 0) + 1,
            zLogical: (w.ezLogical?.[enemyIndex] ?? 0) + 1,
            damageMeta,
          });
        }
        break;
      }

      case "split_into_children": {
        spawnSplitChildren(w, enemyIndex, x, y, effect);
        break;
      }
    }
  }
}

export function finalizeEnemyDeath(
  w: World,
  enemyIndex: number,
  options: {
    damageMeta: DamageMeta;
    source?: LegacyDamageSource;
    damage?: number;
    dmgPhys?: number;
    dmgFire?: number;
    dmgChaos?: number;
    isCrit?: boolean;
    x?: number;
    y?: number;
    awardMomentum?: boolean;
    countKill?: boolean;
    recordPoisonedOnDeath?: boolean;
  },
): boolean {
  if (!w.eAlive[enemyIndex]) return false;

  w.eAlive[enemyIndex] = false;
  const bossDef = getBossDefinitionForEntity(w, enemyIndex);
  if (!bossDef) {
    const brain = ensureEnemyBrain(w, enemyIndex);
    clearEnemyTransientState(brain);
    brain.cooldownLeftSec = 0;
    brain.windupLeftSec = 0;
    setEnemyBehaviorState(brain, "dead");
  } else if (w.eBrain[enemyIndex]) {
    const brain = w.eBrain[enemyIndex]!;
    clearEnemyTransientState(brain);
    brain.cooldownLeftSec = 0;
    brain.windupLeftSec = 0;
    setEnemyBehaviorState(brain, "dead");
  }

  if (options.countKill !== false) {
    w.kills = (w.kills ?? 0) + 1;
  }
  if (options.awardMomentum && !isProcDamage(options.damageMeta)) {
    addMomentumOnKill(w, w.timeSec ?? w.time ?? 0);
  }
  onEnemyKilledForChallenge(w);

  if (options.recordPoisonedOnDeath !== false) {
    const poisonStacks = w.eAilments?.[enemyIndex]?.poison ?? [];
    w.ePoisonedOnDeath ??= [];
    w.ePoisonedOnDeath[enemyIndex] = poisonStacks.length > 0;
  }

  const pos =
    Number.isFinite(options.x) && Number.isFinite(options.y)
      ? { x: options.x as number, y: options.y as number }
      : (() => {
          const ew = getEnemyWorld(w, enemyIndex, KENNEY_TILE_WORLD);
          return { x: ew.wx, y: ew.wy };
        })();

  const enemyType = Array.isArray(w.eType) ? w.eType[enemyIndex] : undefined;
  const enemyDef = bossDef || !Number.isFinite(enemyType)
    ? null
    : registry.enemy(enemyType as import("../../content/enemies").EnemyId);
  executeEnemyDeathEffects(
    w,
    enemyIndex,
    pos.x,
    pos.y,
    bossDef?.id ?? String(enemyDef?.id ?? "UNKNOWN"),
    bossDef?.deathEffects ?? enemyDef?.deathEffects ?? [],
  );
  markBossEncounterDefeated(w, enemyIndex);

  emitEvent(w, {
    type: "ENEMY_KILLED",
    enemyIndex,
    damage: options.damage,
    dmgPhys: options.dmgPhys,
    dmgFire: options.dmgFire,
    dmgChaos: options.dmgChaos,
    isCrit: options.isCrit,
    x: pos.x,
    y: pos.y,
    spawnTriggerId: w.eSpawnTriggerId[enemyIndex],
    source: options.source,
    damageMeta: options.damageMeta,
  });

  // Poisoned enemies explode on death (combat rule)
  const combatRules = collectWorldCombatRules(w);
  if (combatRules.poisonedEnemiesExplodeOnDeath) {
    const poisonStacks = w.eAilments?.[enemyIndex]?.poison ?? [];
    if (poisonStacks.length > 0) {
      const { radius, damageScalar, damageType } = combatRules.poisonedEnemiesExplodeOnDeath;
      const maxLife = Math.max(0, w.eHpMax?.[enemyIndex] ?? 0);
      const explosionDamage = maxLife * damageScalar;
      if (explosionDamage > 0) {
        const dmgPhys = damageType === "PHYSICAL" ? explosionDamage : 0;
        const dmgFire = damageType === "FIRE" ? explosionDamage : 0;
        const dmgChaos = damageType === "CHAOS" ? explosionDamage : 0;
        const meta = makePlayerTriggerHitMeta("RING_POISON_PLAGUE_DETONATION", {
          category: "HIT",
          instigatorId: "player",
          isProcDamage: true,
        });

        emitEvent(w, { type: "VFX", id: "EXPLOSION", x: pos.x, y: pos.y, radius });
        emitEvent(w, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.55 });

        const nearby = queryCircle(w.enemySpatialHash, pos.x, pos.y, radius + 50);
        const seen = new Set<number>();
        for (let i = 0; i < nearby.length; i++) {
          const target = nearby[i];
          if (target === enemyIndex) continue;
          if (seen.has(target)) continue;
          seen.add(target);
          if (!w.eAlive[target]) continue;
          if (!isEnemyInCircle(w, target, pos.x, pos.y, radius)) continue;

          w.eHp[target] -= explosionDamage;
          const targetPos = getEnemyWorld(w, target, KENNEY_TILE_WORLD);
          emitEvent(w, {
            type: "ENEMY_HIT",
            enemyIndex: target,
            damage: explosionDamage,
            dmgPhys,
            dmgFire,
            dmgChaos,
            x: targetPos.wx,
            y: targetPos.wy,
            isCrit: false,
            damageMeta: meta,
            source: "OTHER",
          });

          if (w.eHp[target] <= 0) {
            finalizeEnemyDeath(w, target, {
              damageMeta: meta,
              source: "OTHER",
              damage: explosionDamage,
              dmgPhys,
              dmgFire,
              dmgChaos,
              isCrit: false,
              x: targetPos.wx,
              y: targetPos.wy,
            });
          }
        }
      }
    }
  }

  // Living Bomb death explosion (combat rule)
  if (isLivingBombMarked(w, enemyIndex) && combatRules.livingBomb) {
    const { explosionRadius, explosionDamageScalar } = combatRules.livingBomb;
    const maxLife = Math.max(0, w.eHpMax?.[enemyIndex] ?? 0);
    const explosionDamage = maxLife * explosionDamageScalar;
    if (explosionDamage > 0) {
      const meta = makePlayerTriggerHitMeta("RING_IGNITE_LIVING_BOMB", {
        category: "HIT",
        instigatorId: "player",
        isProcDamage: true,
      });

      emitEvent(w, { type: "VFX", id: "EXPLOSION", x: pos.x, y: pos.y, radius: explosionRadius });
      emitEvent(w, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.6 });

      const nearby = queryCircle(w.enemySpatialHash, pos.x, pos.y, explosionRadius + 50);
      const seen = new Set<number>();
      for (let i = 0; i < nearby.length; i++) {
        const target = nearby[i];
        if (target === enemyIndex) continue;
        if (seen.has(target)) continue;
        seen.add(target);
        if (!w.eAlive[target]) continue;
        if (!isEnemyInCircle(w, target, pos.x, pos.y, explosionRadius)) continue;

        w.eHp[target] -= explosionDamage;
        const targetPos = getEnemyWorld(w, target, KENNEY_TILE_WORLD);
        emitEvent(w, {
          type: "ENEMY_HIT",
          enemyIndex: target,
          damage: explosionDamage,
          dmgPhys: 0,
          dmgFire: explosionDamage,
          dmgChaos: 0,
          x: targetPos.wx,
          y: targetPos.wy,
          isCrit: false,
          damageMeta: meta,
          source: "OTHER",
        });

        if (w.eHp[target] <= 0) {
          finalizeEnemyDeath(w, target, {
            damageMeta: meta,
            source: "OTHER",
            damage: explosionDamage,
            dmgPhys: 0,
            dmgFire: explosionDamage,
            dmgChaos: 0,
            isCrit: false,
            x: targetPos.wx,
            y: targetPos.wy,
          });
        }
      }
    }
    clearLivingBombMark(w, enemyIndex);
  }

  return true;
}
