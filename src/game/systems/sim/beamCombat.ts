import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";
import { resolveDotStats } from "../../combat_mods/stats/combatStatsResolver";
import { collectWorldStatMods } from "../../progression/effects/worldEffects";
import type { DamageMeta } from "../../events";
import {
  inferLegacySourceFromMeta,
  isProcDamage,
  makeUnknownDamageMeta,
  makeWeaponDotMeta,
} from "../../combat/damageMeta";
import { finalizeEnemyDeath } from "../enemies/finalize";
import { isPoeEnemyDormant } from "../../objectives/poeMapObjectiveSystem";
import { resolveClampedBeamGeometry } from "./beamShared";

export type BeamContactConfig = {
  dirX: number;
  dirY: number;
  maxRangePx: number;
  widthPx: number;
  glowIntensity: number;
  dpsPhys: number;
  dpsFire: number;
  dpsChaos: number;
  damageMeta?: DamageMeta;
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
    if (isPoeEnemyDormant(w, e)) continue;
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
  w.playerBeamWidthPx = 0;
  w.playerBeamGlowIntensity = 0;
  w.playerBeamDpsPhys = 0;
  w.playerBeamDpsFire = 0;
  w.playerBeamDpsChaos = 0;
  w.playerBeamDamageMeta = undefined;
}

export function updatePlayerBeamCombat(w: World, cfg: BeamContactConfig): void {
  const playerWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const originX = playerWorld.wx;
  const originY = playerWorld.wy;
  const beam = resolveClampedBeamGeometry(w, {
    originX,
    originY,
    originZ: w.pzVisual ?? w.pz ?? 0,
    dirX: cfg.dirX,
    dirY: cfg.dirY,
    maxRangePx: cfg.maxRangePx,
    widthPx: cfg.widthPx,
  });

  const damageMeta = cfg.damageMeta ?? makeUnknownDamageMeta("BEAM_DAMAGE_META_MISSING", { category: "DOT" });

  w.playerBeamActive = true;
  w.playerBeamStartX = originX;
  w.playerBeamStartY = originY;
  w.playerBeamEndX = beam.endX;
  w.playerBeamEndY = beam.endY;
  w.playerBeamDirX = beam.dirX;
  w.playerBeamDirY = beam.dirY;
  w.playerBeamWidthPx = Math.max(1, cfg.widthPx);
  w.playerBeamGlowIntensity = Math.max(0, cfg.glowIntensity);
  w.playerBeamDpsPhys = Math.max(0, cfg.dpsPhys);
  w.playerBeamDpsFire = Math.max(0, cfg.dpsFire);
  w.playerBeamDpsChaos = Math.max(0, cfg.dpsChaos);
  w.playerBeamDamageMeta = damageMeta;
}

export function tickBeamContactsOnce(w: World, dtTick: number): void {
  if (!w.playerBeamActive) return;

  const damageMeta = w.playerBeamDamageMeta ?? makeWeaponDotMeta("beam_unknown");
  const legacySource = inferLegacySourceFromMeta(damageMeta);
  const targets = collectBeamTargets(
    w,
    w.playerBeamStartX,
    w.playerBeamStartY,
    w.playerBeamDirX,
    w.playerBeamDirY,
    Math.hypot(w.playerBeamEndX - w.playerBeamStartX, w.playerBeamEndY - w.playerBeamStartY),
    w.playerBeamWidthPx,
  );
  if (targets.length === 0) return;

  const dotStats = resolveDotStats({ statMods: collectWorldStatMods(w) });
  const dotScale = Math.max(0, Math.max(0.0001, dotStats.tickRateMult));

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!w.eAlive[t.enemyIndex]) continue;

    let finalPhys = w.playerBeamDpsPhys * dtTick * dotScale;
    let finalFire = w.playerBeamDpsFire * dtTick * dotScale;
    let finalChaos = w.playerBeamDpsChaos * dtTick * dotScale;
    const damage = finalPhys + finalFire + finalChaos;
    if (damage <= 0) continue;

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
      isCrit: false,
      source: legacySource,
      damageMeta,
    });

    if (w.eHp[t.enemyIndex] > 0) continue;

    const poisonStacks = w.eAilments?.[t.enemyIndex]?.poison ?? [];
    w.ePoisonedOnDeath[t.enemyIndex] = poisonStacks.length > 0;
    finalizeEnemyDeath(w, t.enemyIndex, {
      damageMeta,
      source: legacySource,
      x: t.wx,
      y: t.wy,
      awardMomentum: !isProcDamage(damageMeta),
      recordPoisonedOnDeath: false,
    });
  }
}
