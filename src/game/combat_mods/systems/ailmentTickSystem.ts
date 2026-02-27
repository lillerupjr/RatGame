import {
  createEnemyAilmentsState,
  tickEnemyAilments,
} from "../ailments/enemyAilments";
import { AILMENT_TICK_INTERVAL_SEC } from "../ailments/ailmentTypes";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";
import type { World } from "../../../engine/world/world";
import { emitEvent } from "../../../engine/world/world";
import { onEnemyKilledForChallenge } from "../../systems/progression/roomChallenge";
import { getEnemyWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";

const EPS = 1e-9;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Apply mitigation for DoT ticks:
 * resist -> damageReduction.
 * For now resists and armor are 0 by default, but keep the plumbing.
 */
function applyDotMitigation(raw: number, resist: number, damageReduction: number): number {
  const r = clamp01(resist); // if resist is stored as 0..1
  let out = raw * (1 - r);
  out *= 1 - clamp01(damageReduction);
  return out;
}

function getEnemyEventPos(w: any, e: number): { x: number; y: number } {
  const hasEnemyAnchor =
    Array.isArray(w.egxi) &&
    Array.isArray(w.egyi) &&
    Array.isArray(w.egox) &&
    Array.isArray(w.egoy);
  if (!hasEnemyAnchor) return { x: 0, y: 0 };
  const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
  return { x: ew.wx, y: ew.wy };
}

export function ailmentTickSystem(w: any, dt: number): void {
  const n = w.eHp?.length ?? 0;
  if (!w.eAlive || !w.eHp) return;
  w.eDotTickAcc ??= [];

  for (let e = 0; e < n; e++) {
    if (!w.eAlive[e]) continue;

    if (!w.eAilments) w.eAilments = [];
    if (!w.eAilments[e]) w.eAilments[e] = createEnemyAilmentsState();
    const st = w.eAilments[e];

    // Poison/ignite/bleed now tick on a fixed cadence.
    let poisonRaw = 0;
    let bleedRaw = 0;
    let igniteRaw = 0;
    let remaining = Math.max(0, dt);
    let acc = Math.max(0, w.eDotTickAcc[e] ?? 0);
    while (remaining > EPS) {
      const stepToTick = AILMENT_TICK_INTERVAL_SEC - acc;
      const step = Math.min(remaining, Math.max(EPS, stepToTick));

      let poisonDps = 0;
      for (const s of st.poison) poisonDps += s.dps;
      let bleedDps = 0;
      for (const s of st.bleed) bleedDps += s.dps;
      const igniteDps = st.ignite ? st.ignite.dps : 0;

      // Advance ailment timers for this slice.
      tickEnemyAilments(st, step);

      remaining -= step;
      acc += step;

      // Apply DoT only at discrete 0.5s boundaries.
      if (acc + EPS >= AILMENT_TICK_INTERVAL_SEC) {
        bleedRaw += bleedDps * AILMENT_TICK_INTERVAL_SEC;
        poisonRaw += poisonDps * AILMENT_TICK_INTERVAL_SEC;
        igniteRaw += igniteDps * AILMENT_TICK_INTERVAL_SEC;
        acc = 0;
      }
    }
    if (st.poison.length === 0 && st.bleed.length === 0 && !st.ignite) acc = 0;
    w.eDotTickAcc[e] = acc;

    // Read enemy mitigation fields (default to 0)
    const resistChaos = w.eResistChaos?.[e] ?? 0;
    const resistPhysical = w.eResistPhysical?.[e] ?? 0;
    const resistFire = w.eResistFire?.[e] ?? 0;

    const damageReduction = w.eDamageReduction?.[e] ?? 0;

    const poisonFinal = applyDotMitigation(poisonRaw, resistChaos, damageReduction);
    const bleedFinal = applyDotMitigation(bleedRaw, resistPhysical, damageReduction);
    const igniteFinal = applyDotMitigation(igniteRaw, resistFire, damageReduction);

    const total = poisonFinal + bleedFinal + igniteFinal;
    if (total > 0) {
      w.eHp[e] -= total;
      w.metrics = w.metrics ?? {};
      w.metrics.dps = w.metrics.dps ?? createDpsMetrics();
      recordDamage(w.metrics.dps, w.timeSec ?? w.time ?? 0, total);
      const pos = getEnemyEventPos(w, e);
      emitEvent(w, {
        type: "ENEMY_HIT",
        enemyIndex: e,
        damage: total,
        dmgPhys: bleedFinal,
        dmgFire: igniteFinal,
        dmgChaos: poisonFinal,
        x: pos.x,
        y: pos.y,
        isCrit: false,
        source: "OTHER",
      });

      if (w.eHp[e] <= 0) {
        w.eAlive[e] = false;
        w.kills = (w.kills ?? 0) + 1;
        if ("roomChallengeActive" in w && "roomChallengeKillsCount" in w) {
          onEnemyKilledForChallenge(w as World);
        }
        w.ePoisonedOnDeath ??= [];
        w.ePoisonedOnDeath[e] = (st.poison.length > 0);
        emitEvent(w, {
          type: "ENEMY_KILLED",
          enemyIndex: e,
          x: pos.x,
          y: pos.y,
          source: "OTHER",
        });
      }
    }
  }
}
