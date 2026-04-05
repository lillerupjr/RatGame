import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";
import { relicTriggerMomentumDamageMultiplier } from "./momentum";
import { raycast3D } from "./collision3D";
import { getCardById } from "../../combat_mods/content/cards/cardPool";
import { resolveDotStats } from "../../combat_mods/stats/combatStatsResolver";
import type { DamageMeta } from "../../events";
import {
  inferLegacySourceFromMeta,
  isProcDamage,
  makeUnknownDamageMeta,
  makeWeaponDotMeta,
} from "../../combat/damageMeta";
import { finalizeEnemyDeath } from "../enemies/finalize";
import { isPoeEnemyDormant } from "../../objectives/poeMapObjectiveSystem";

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

  const damageMeta = cfg.damageMeta ?? makeUnknownDamageMeta("BEAM_DAMAGE_META_MISSING", { category: "DOT" });

  w.playerBeamActive = true;
  w.playerBeamStartX = originX;
  w.playerBeamStartY = originY;
  w.playerBeamEndX = originX + dirX * endDistance;
  w.playerBeamEndY = originY + dirY * endDistance;
  w.playerBeamDirX = dirX;
  w.playerBeamDirY = dirY;
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

  const cardIds = [...(w.cards ?? []), ...(w.combatCardIds ?? [])];
  const cards = cardIds
    .map((id) => getCardById(id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));
  const dotStats = resolveDotStats({ cards });
  const relicIds: string[] = Array.isArray(w.relics) ? w.relics : [];
  const relicDotMoreMult =
    (relicIds.includes("PASS_DOT_MORE_50") ? 1.5 : 1) *
    (relicIds.includes("SPEC_DOT_SPECIALIST") ? 3.0 : 1);
  const dotScale = Math.max(0, relicDotMoreMult * Math.max(0.0001, dotStats.tickRateMult));

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!w.eAlive[t.enemyIndex]) continue;

    let finalPhys = w.playerBeamDpsPhys * dtTick * dotScale;
    let finalFire = w.playerBeamDpsFire * dtTick * dotScale;
    let finalChaos = w.playerBeamDpsChaos * dtTick * dotScale;
    if (isProcDamage(damageMeta)) {
      const procMult = relicTriggerMomentumDamageMultiplier(w);
      if (procMult !== 1) {
        finalPhys *= procMult;
        finalFire *= procMult;
        finalChaos *= procMult;
      }
    }
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
