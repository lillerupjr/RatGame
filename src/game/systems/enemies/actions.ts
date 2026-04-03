import type { World } from "../../../engine/world/world";
import { emitEvent } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { getEnemyAimWorld, getPlayerAimWorld } from "../../combat/aimPoints";
import { makeEnemyHitMeta } from "../../combat/damageMeta";
import { EnemyId } from "../../content/enemies";
import { registry } from "../../content/registry";
import { PRJ_KIND, spawnProjectile } from "../../factories/projectileFactory";
import { applyPlayerIncomingDamage } from "../sim/playerArmor";
import { breakMomentumOnLifeDamage } from "../sim/momentum";
import { clearEnemyTransientState, ensureEnemyBrain, setEnemyBehaviorState } from "./brain";
import { finalizeEnemyDeath } from "./finalize";

function sfxIdForProjectileKind(projectileKind: number): "FIRE_SYRINGE" | "FIRE_OTHER" {
  if (projectileKind === PRJ_KIND.SYRINGE || projectileKind === PRJ_KIND.ACID) return "FIRE_SYRINGE";
  return "FIRE_OTHER";
}

function resolveLeapDurationSec(
  w: World,
  enemyIndex: number,
  leapSpeed: number,
  impactRadius: number,
  desiredRange: number,
): number {
  const enemyPos = getEnemyWorld(w, enemyIndex, KENNEY_TILE_WORLD);
  const playerPos = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const centerDist = Math.hypot(playerPos.wx - enemyPos.wx, playerPos.wy - enemyPos.wy);
  const surfaceDist = Math.max(0, centerDist - ((w.eR[enemyIndex] ?? 0) + (w.playerR ?? 0)));
  const travelDist = Math.max(desiredRange, surfaceDist) + Math.max(0, impactRadius);
  return Math.max(0.12, travelDist / Math.max(1, leapSpeed));
}

export function enemyActionSystem(w: World, _dt: number): void {
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const brain = ensureEnemyBrain(w, i);
    if (brain.state !== "acting") continue;

    const type = w.eType[i] as EnemyId;
    if (type === EnemyId.BOSS) continue;

    const archetype = registry.enemy(type);
    const ability = archetype.ability;
    if (!ability) continue;

    if (ability.kind === "projectile") {
      const enemyAim = getEnemyAimWorld(w, i);
      const playerAim = getPlayerAimWorld(w);
      const dirX = playerAim.x - enemyAim.x;
      const dirY = playerAim.y - enemyAim.y;
      const damageMeta = makeEnemyHitMeta(String(archetype.id), ability.abilityId, {
        category: "HIT",
        mode: "INTRINSIC",
        instigatorId: String(i),
      });

      spawnProjectile(w, {
        kind: ability.projectileKind,
        x: enemyAim.x,
        y: enemyAim.y,
        dirX,
        dirY,
        speed: ability.speed,
        damage: ability.damage,
        dmgPhys: 0,
        dmgFire: 0,
        dmgChaos: ability.damage,
        radius: ability.radius,
        pierce: 0,
        maxDist: ability.speed * ability.ttl,
        ttl: ability.ttl,
        hitsPlayer: true,
        noCollide: true,
        z: (w.ezVisual?.[i] ?? 0) + 1,
        zLogical: (w.ezLogical?.[i] ?? 0) + 1,
        damageMeta,
      });

      emitEvent(w, {
        type: "SFX",
        id: sfxIdForProjectileKind(ability.projectileKind),
        vol: 0.65,
        rate: 1,
      });

      clearEnemyTransientState(brain);
      brain.cooldownLeftSec = ability.cooldownSec;
      setEnemyBehaviorState(brain, "cooldown");
      continue;
    }

    if (ability.kind === "explode") {
      const enemyPos = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const playerPos = getPlayerWorld(w, KENNEY_TILE_WORLD);
      const damageMeta = makeEnemyHitMeta(String(archetype.id), ability.abilityId, {
        category: "HIT",
        mode: "INTRINSIC",
        instigatorId: String(i),
      });

      const dx = playerPos.wx - enemyPos.wx;
      const dy = playerPos.wy - enemyPos.wy;
      const rr = ability.radius + (w.playerR ?? 0);
      if (dx * dx + dy * dy <= rr * rr) {
        const lifeDamage = applyPlayerIncomingDamage(w, ability.damage);
        w.playerHp -= lifeDamage;
        if (lifeDamage > 0) {
          breakMomentumOnLifeDamage(w, w.timeSec ?? w.time ?? 0);
        }
        emitEvent(w, {
          type: "PLAYER_HIT",
          damage: lifeDamage,
          x: playerPos.wx,
          y: playerPos.wy,
          damageMeta,
        });
      }

      emitEvent(w, {
        type: "VFX",
        id: "EXPLOSION",
        x: enemyPos.wx,
        y: enemyPos.wy,
        radius: ability.radius,
      });
      emitEvent(w, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.75, rate: 1 });

      clearEnemyTransientState(brain);
      finalizeEnemyDeath(w, i, {
        damageMeta,
        source: "OTHER",
        x: enemyPos.wx,
        y: enemyPos.wy,
        awardMomentum: false,
      });
      continue;
    }

    if (brain.leapTimeLeftSec <= 0 && brain.stateTimeSec <= 0.0001) {
      const enemyPos = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      const playerPos = getPlayerWorld(w, KENNEY_TILE_WORLD);
      const dirX = playerPos.wx - enemyPos.wx;
      const dirY = playerPos.wy - enemyPos.wy;
      const len = Math.hypot(dirX, dirY);
      const fallbackLen = Math.hypot(w.eFaceX[i] ?? 0, w.eFaceY[i] ?? 0) || 1;
      brain.leapDirX = len > 1e-6 ? dirX / len : (w.eFaceX[i] ?? 1) / fallbackLen;
      brain.leapDirY = len > 1e-6 ? dirY / len : (w.eFaceY[i] ?? 0) / fallbackLen;
      brain.leapTimeLeftSec = resolveLeapDurationSec(
        w,
        i,
        ability.leapSpeed,
        ability.impactRadius ?? 0,
        archetype.movement.desiredRange,
      );
      brain.leapHitDone = false;
      emitEvent(w, { type: "SFX", id: "FIRE_OTHER", vol: 0.65, rate: 1 });
      continue;
    }

    const enemyPos = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
    const playerPos = getPlayerWorld(w, KENNEY_TILE_WORLD);
    const impactRadius = (ability.impactRadius ?? 0) + (w.playerR ?? 0) + (w.eR[i] ?? 0);
    const dx = playerPos.wx - enemyPos.wx;
    const dy = playerPos.wy - enemyPos.wy;
    const damageMeta = makeEnemyHitMeta(String(archetype.id), ability.abilityId, {
      category: "HIT",
      mode: "INTRINSIC",
      instigatorId: String(i),
    });

    if (!brain.leapHitDone && dx * dx + dy * dy <= impactRadius * impactRadius) {
      const lifeDamage = applyPlayerIncomingDamage(w, ability.damage);
      w.playerHp -= lifeDamage;
      if (lifeDamage > 0) {
        breakMomentumOnLifeDamage(w, w.timeSec ?? w.time ?? 0);
      }
      emitEvent(w, {
        type: "PLAYER_HIT",
        damage: lifeDamage,
        x: playerPos.wx,
        y: playerPos.wy,
        damageMeta,
      });
      brain.leapHitDone = true;
    }

    if (brain.leapTimeLeftSec > 0) {
      continue;
    }

    clearEnemyTransientState(brain);
    brain.cooldownLeftSec = ability.cooldownSec;
    setEnemyBehaviorState(brain, "cooldown");
  }
}
