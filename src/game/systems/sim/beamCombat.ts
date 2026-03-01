import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { registry } from "../../content/registry";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { applyAilmentsFromHit, ensureEnemyAilmentsAt } from "../../combat_mods/ailments/applyAilmentsFromHit";
import { resolveCritRoll01, resolveProjectileDamagePacket } from "../../combat_mods/runtime/critDamagePacket";
import type { DotStatsScalars } from "../../combat_mods/stats/combatStatsResolver";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";
import { onEnemyKilledForChallenge } from "../progression/roomChallenge";
import { addMomentumOnKill, relicTriggerMomentumDamageMultiplier } from "./momentum";
import { raycast3D } from "./collision3D";

export type BeamDamageConfig = {
  dirX: number;
  dirY: number;
  maxRangePx: number;
  tickIntervalSec: number;
  widthPx: number;
  glowIntensity: number;
  dpsPhys: number;
  dpsFire: number;
  dpsChaos: number;
  critChance: number;
  critMulti: number;
  chanceBleed: number;
  chanceIgnite: number;
  chancePoison: number;
  projectileKind: number;
  critRolls: 1 | 2;
  dotScalars: DotStatsScalars;
  allDamageContributesToPoison: boolean;
};

type BeamTarget = {
  enemyIndex: number;
  distance: number;
  wx: number;
  wy: number;
};

function collectBeamTargets(
  w: World,
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  maxDistance: number,
  widthPx: number,
): BeamTarget[] {
  const out: BeamTarget[] = [];
  const maxRadius = Math.max(0, widthPx * 0.5);

  for (let e = 0; e < w.eAlive.length; e++) {
    if (!w.eAlive[e]) continue;
    const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
    const dx = ew.wx - originX;
    const dy = ew.wy - originY;
    const along = dx * dirX + dy * dirY;
    if (along < 0 || along > maxDistance) continue;

    const perpSq = dx * dx + dy * dy - along * along;
    const hitR = (w.eR[e] ?? 0) + maxRadius;
    if (perpSq > hitR * hitR) continue;

    out.push({ enemyIndex: e, distance: along, wx: ew.wx, wy: ew.wy });
  }

  out.sort((a, b) => a.distance - b.distance);
  return out;
}

export function resetPlayerBeamState(w: World): void {
  w.playerBeamActive = false;
  w.playerBeamTickAccumulator = 0;
  w.playerBeamWidthPx = 0;
  w.playerBeamGlowIntensity = 0;
}

export function updatePlayerBeamCombat(w: World, dt: number, cfg: BeamDamageConfig): void {
  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const originX = pWorld.wx;
  const originY = pWorld.wy;

  const dirLen = Math.hypot(cfg.dirX, cfg.dirY);
  const dirX = dirLen > 0.0001 ? cfg.dirX / dirLen : 1;
  const dirY = dirLen > 0.0001 ? cfg.dirY / dirLen : 0;

  const ray = raycast3D(
    originX,
    originY,
    w.pzVisual ?? w.pz ?? 0,
    dirX,
    dirY,
    0,
    cfg.maxRangePx,
  );
  const endDistance = ray.hit && ray.hitType === "TILE"
    ? Math.max(0, Math.min(cfg.maxRangePx, ray.hitDistance))
    : Math.max(0, cfg.maxRangePx);

  w.playerBeamActive = true;
  w.playerBeamStartX = originX;
  w.playerBeamStartY = originY;
  w.playerBeamEndX = originX + dirX * endDistance;
  w.playerBeamEndY = originY + dirY * endDistance;
  w.playerBeamDirX = dirX;
  w.playerBeamDirY = dirY;
  w.playerBeamWidthPx = Math.max(1, cfg.widthPx);
  w.playerBeamGlowIntensity = Math.max(0, cfg.glowIntensity);

  const interval = Math.max(0.01, cfg.tickIntervalSec);
  w.playerBeamTickAccumulator += dt;
  if (w.playerBeamTickAccumulator < interval) return;

  const source = registry.projectileSourceFromKind(cfg.projectileKind);
  const targets = collectBeamTargets(
    w,
    originX,
    originY,
    dirX,
    dirY,
    endDistance,
    cfg.widthPx,
  );

  while (w.playerBeamTickAccumulator >= interval) {
    w.playerBeamTickAccumulator -= interval;
    if (targets.length === 0) continue;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!w.eAlive[t.enemyIndex]) continue;

      const critRoll = resolveCritRoll01(
        cfg.critChance,
        () => w.rng.range(0, 1),
        cfg.critRolls,
      );
      const resolved = resolveProjectileDamagePacket(
        {
          physical: Math.max(0, cfg.dpsPhys * interval),
          fire: Math.max(0, cfg.dpsFire * interval),
          chaos: Math.max(0, cfg.dpsChaos * interval),
          critChance: cfg.critChance,
          critMulti: cfg.critMulti,
        },
        critRoll.roll01,
      );

      let finalPhys = resolved.physical;
      let finalFire = resolved.fire;
      let finalChaos = resolved.chaos;
      if (source === "OTHER") {
        const procMult = relicTriggerMomentumDamageMultiplier(w);
        if (procMult !== 1) {
          finalPhys *= procMult;
          finalFire *= procMult;
          finalChaos *= procMult;
        }
      }
      const damage = finalPhys + finalFire + finalChaos;
      if (damage <= 0) continue;

      if (!w.eAilments) w.eAilments = [];
      const ailmentState = ensureEnemyAilmentsAt(w.eAilments, t.enemyIndex);
      applyAilmentsFromHit(
        ailmentState,
        { physical: finalPhys, fire: finalFire, chaos: finalChaos },
        {
          bleed: cfg.chanceBleed,
          ignite: cfg.chanceIgnite,
          poison: cfg.chancePoison,
        },
        {
          bleed: w.rng.range(0, 1),
          ignite: w.rng.range(0, 1),
          poison: w.rng.range(0, 1),
        },
        {
          poisonDamageMult: Math.max(0, cfg.dotScalars.poisonDamageMult),
          igniteDamageMult: Math.max(0, cfg.dotScalars.igniteDamageMult),
          poisonDurationMult: Math.max(0, cfg.dotScalars.dotDurationMult),
          igniteDurationMult: Math.max(0, cfg.dotScalars.dotDurationMult),
          allDamageContributesToPoison: cfg.allDamageContributesToPoison,
        },
      );

      w.eHp[t.enemyIndex] -= damage;

      if (!(w as any).metrics) (w as any).metrics = {};
      if (!(w as any).metrics.dps) (w as any).metrics.dps = createDpsMetrics();
      recordDamage((w as any).metrics.dps, (w as any).timeSec ?? (w as any).time ?? 0, damage);

      if (w.dpsEnabled) {
        w.dpsTotalDamage += damage;
        w.dpsRecentDamage.push(damage);
        w.dpsRecentTimes.push(w.time);
      }

      emitEvent(w, {
        type: "ENEMY_HIT",
        enemyIndex: t.enemyIndex,
        damage,
        dmgPhys: finalPhys,
        dmgFire: finalFire,
        dmgChaos: finalChaos,
        x: t.wx,
        y: t.wy,
        isCrit: resolved.isCrit,
        critMult: cfg.critMulti,
        source,
      });

      if (w.eHp[t.enemyIndex] > 0) continue;

      w.eAlive[t.enemyIndex] = false;
      w.kills++;
      if (source !== "OTHER") {
        addMomentumOnKill(w, w.timeSec ?? w.time ?? 0);
      }
      onEnemyKilledForChallenge(w);
      w.ePoisonedOnDeath[t.enemyIndex] = w.ePoisonT[t.enemyIndex] > 0;
      emitEvent(w, {
        type: "ENEMY_KILLED",
        enemyIndex: t.enemyIndex,
        x: t.wx,
        y: t.wy,
        source,
      });
    }
  }
}
