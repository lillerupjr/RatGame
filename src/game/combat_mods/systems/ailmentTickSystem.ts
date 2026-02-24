import {
  createEnemyAilmentsState,
  tickEnemyAilments,
} from "../ailments/enemyAilments";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";

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

export function ailmentTickSystem(w: any, dt: number): void {
  const n = w.eHp?.length ?? 0;
  if (!w.eAlive || !w.eHp) return;

  for (let e = 0; e < n; e++) {
    if (!w.eAlive[e]) continue;

    if (!w.eAilments) w.eAilments = [];
    if (!w.eAilments[e]) w.eAilments[e] = createEnemyAilmentsState();
    const st = w.eAilments[e];

    // Tick timers
    tickEnemyAilments(st, dt);

    // Compute total raw DPS from active stacks
    let poisonDps = 0;
    for (const s of st.poison) poisonDps += s.dps;

    let bleedDps = 0;
    for (const s of st.bleed) bleedDps += s.dps;

    const igniteDps = st.ignite ? st.ignite.dps : 0;

    // Apply per-frame damage
    const poisonRaw = poisonDps * dt;
    const bleedRaw = bleedDps * dt;
    const igniteRaw = igniteDps * dt;

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

      // Optional: emit a DOT event for debug UI (only if event queue exists).
      // Keep minimal; do not add triggers.
      if (w.events?.push) {
        w.events.push({ type: "ENEMY_DOT", e, damage: total });
      }
    }
  }
}
