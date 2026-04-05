import { createEnemyAilmentsState, tickEnemyAilments } from "../ailments/enemyAilments";
import { AILMENT_TICK_INTERVAL_SEC } from "../ailments/ailmentTypes";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";
import type { World } from "../../../engine/world/world";
import { emitEvent } from "../../../engine/world/world";
import { getEnemyWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getCardById } from "../content/cards/cardPool";
import { resolveDotStats } from "../stats/combatStatsResolver";
import { makeAilmentDotMeta } from "../../combat/damageMeta";
import { DOT_TICK_INTERVAL_SEC } from "../../combat/dot/dotConstants";
import { finalizeEnemyDeath } from "../../systems/enemies/finalize";
import { isPoeEnemyDormant } from "../../objectives/poeMapObjectiveSystem";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Apply mitigation for DoT ticks:
 * resist -> damageReduction.
 */
function applyDotMitigation(raw: number, resist: number, damageReduction: number): number {
  const r = clamp01(resist);
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

export function tickAilmentsOnce(w: any, dtTick: number): void {
  const n = w.eHp?.length ?? 0;
  if (!w.eAlive || !w.eHp) return;

  const cardIds = [...(w.cards ?? []), ...(w.combatCardIds ?? [])];
  const cards = cardIds
    .map((id: string) => getCardById(id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));
  const dotStats = resolveDotStats({ cards });
  const relicIds: string[] = Array.isArray(w.relics) ? w.relics : [];
  // Dot-only scaling stays in the DoT pipeline; global hit multipliers must not be applied here.
  const relicDotMoreMult =
    (relicIds.includes("PASS_DOT_MORE_50") ? 1.5 : 1) *
    (relicIds.includes("SPEC_DOT_SPECIALIST") ? 3.0 : 1);
  const tickRateMult = Math.max(0.0001, dotStats.tickRateMult);

  for (let e = 0; e < n; e++) {
    if (!w.eAlive[e]) continue;
    if (isPoeEnemyDormant(w as World, e)) continue;

    if (!w.eAilments) w.eAilments = [];
    if (!w.eAilments[e]) w.eAilments[e] = createEnemyAilmentsState();
    const st = w.eAilments[e];
    const igniteRaw = (st as any).ignite;
    if (!Array.isArray(igniteRaw)) {
      st.ignite = igniteRaw ? [igniteRaw] : [];
    }

    let poisonDps = 0;
    for (const s of st.poison) poisonDps += s.dps;
    let bleedDps = 0;
    for (const s of st.bleed) bleedDps += s.dps;
    let igniteDps = 0;
    for (const s of st.ignite) igniteDps += s.dps;

    tickEnemyAilments(st, dtTick);

    // --- Status VFX transitions ---
    const pos0 = getEnemyEventPos(w, e);
    // Bleed
    if (st.bleed.length > 0 && !st.bleedVfxAlive) {
      st.bleedVfxAlive = true;
      emitEvent(w, {
        type: "VFX",
        id: "STATUS_BLEED_LOOP",
        x: pos0.x,
        y: pos0.y,
        loop: true,
        scale: 1,
        followEnemyIndex: e,
        offsetYPx: -16,
      });
    } else if (st.bleed.length === 0 && st.bleedVfxAlive) {
      st.bleedVfxAlive = false;
      emitEvent(w, { type: "VFX_STOP_FOLLOW", id: "STATUS_BLEED_LOOP", enemyIndex: e });
    }
    // Poison
    if (st.poison.length > 0 && !st.poisonVfxAlive) {
      st.poisonVfxAlive = true;
      emitEvent(w, {
        type: "VFX",
        id: "STATUS_POISON_LOOP",
        x: pos0.x,
        y: pos0.y,
        loop: true,
        scale: 1,
        followEnemyIndex: e,
        offsetYPx: -16,
      });
    } else if (st.poison.length === 0 && st.poisonVfxAlive) {
      st.poisonVfxAlive = false;
      emitEvent(w, { type: "VFX_STOP_FOLLOW", id: "STATUS_POISON_LOOP", enemyIndex: e });
    }
    // Burning (ignite)
    if (st.ignite.length > 0 && !st.burningVfxAlive) {
      st.burningVfxAlive = true;
      emitEvent(w, {
        type: "VFX",
        id: "STATUS_BURNING_LOOP",
        x: pos0.x,
        y: pos0.y,
        loop: true,
        scale: 1,
        followEnemyIndex: e,
        offsetYPx: -16,
      });
    } else if (st.ignite.length === 0 && st.burningVfxAlive) {
      st.burningVfxAlive = false;
      emitEvent(w, { type: "VFX_STOP_FOLLOW", id: "STATUS_BURNING_LOOP", enemyIndex: e });
    }

    const tickScale = dtTick / AILMENT_TICK_INTERVAL_SEC;
    const poisonRaw = poisonDps * AILMENT_TICK_INTERVAL_SEC * tickScale * tickRateMult;
    const bleedRaw = bleedDps * AILMENT_TICK_INTERVAL_SEC * tickScale * tickRateMult;
    const igniteRawDamage = igniteDps * AILMENT_TICK_INTERVAL_SEC * tickScale * tickRateMult;

    // Read enemy mitigation fields (default to 0)
    const resistChaos = w.eResistChaos?.[e] ?? 0;
    const resistPhysical = w.eResistPhysical?.[e] ?? 0;
    const resistFire = w.eResistFire?.[e] ?? 0;
    const damageReduction = w.eDamageReduction?.[e] ?? 0;

    const poisonFinal = applyDotMitigation(
      poisonRaw * dotStats.poisonDamageMult * relicDotMoreMult,
      resistChaos,
      damageReduction,
    );
    const bleedFinal = applyDotMitigation(bleedRaw * relicDotMoreMult, resistPhysical, damageReduction);
    const igniteFinal = applyDotMitigation(
      igniteRawDamage * dotStats.igniteDamageMult * relicDotMoreMult,
      resistFire,
      damageReduction,
    );

    let totalApplied = 0;
    const pos = getEnemyEventPos(w, e);
    const components: Array<{
      ailment: "BLEED" | "IGNITE" | "POISON";
      damage: number;
      dmgPhys: number;
      dmgFire: number;
      dmgChaos: number;
    }> = [
      { ailment: "BLEED", damage: bleedFinal, dmgPhys: bleedFinal, dmgFire: 0, dmgChaos: 0 },
      { ailment: "IGNITE", damage: igniteFinal, dmgPhys: 0, dmgFire: igniteFinal, dmgChaos: 0 },
      { ailment: "POISON", damage: poisonFinal, dmgPhys: 0, dmgFire: 0, dmgChaos: poisonFinal },
    ];

    for (let ci = 0; ci < components.length; ci++) {
      if (!w.eAlive[e]) break;
      const comp = components[ci];
      if (!(comp.damage > 0)) continue;

      const ailmentMeta = makeAilmentDotMeta(comp.ailment);
      w.eHp[e] -= comp.damage;
      totalApplied += comp.damage;

      emitEvent(w, {
        type: "ENEMY_HIT",
        enemyIndex: e,
        damage: comp.damage,
        dmgPhys: comp.dmgPhys,
        dmgFire: comp.dmgFire,
        dmgChaos: comp.dmgChaos,
        x: pos.x,
        y: pos.y,
        isCrit: false,
        source: "OTHER",
        damageMeta: ailmentMeta,
      });

      if (w.eHp[e] > 0) continue;

      w.ePoisonedOnDeath ??= [];
      w.ePoisonedOnDeath[e] = st.poison.length > 0;
      finalizeEnemyDeath(w as World, e, {
        damageMeta: ailmentMeta,
        source: "OTHER",
        x: pos.x,
        y: pos.y,
        recordPoisonedOnDeath: false,
      });
      break;
    }

    if (totalApplied > 0) {
      w.metrics = w.metrics ?? {};
      w.metrics.dps = w.metrics.dps ?? createDpsMetrics();
      recordDamage(w.metrics.dps, w.timeSec ?? w.time ?? 0, totalApplied);
    }
  }
}

/**
 * Backwards-compatible wrapper that simulates fixed-rate ticks over variable frame dt.
 */
export function ailmentTickSystem(w: any, dt: number): void {
  const runtime = w as any;
  runtime._ailmentTickAcc = Math.max(0, runtime._ailmentTickAcc ?? 0) + Math.max(0, dt);
  while (runtime._ailmentTickAcc >= DOT_TICK_INTERVAL_SEC) {
    runtime._ailmentTickAcc -= DOT_TICK_INTERVAL_SEC;
    tickAilmentsOnce(w, DOT_TICK_INTERVAL_SEC);
  }
}
