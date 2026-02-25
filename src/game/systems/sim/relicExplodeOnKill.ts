import type { World } from "../../../engine/world/world";
import { normalizeWorldRelics } from "../progression/relics";
import type { RelicTriggerEvent } from "../../events";
import { dispatchRelicTriggers, RELIC_RETRIGGER_DELAY_SEC } from "../progression/relicTriggerSystem";

function findKillingBlowDamage(events: World["events"], killEventIndex: number, enemyIndex: number): number {
  for (let i = killEventIndex - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type !== "ENEMY_HIT") continue;
    if (ev.enemyIndex !== enemyIndex) continue;
    return Math.max(0, ev.damage ?? 0);
  }
  return 0;
}

export function relicExplodeOnKillSystem(w: World, _dt: number): void {
  normalizeWorldRelics(w);
  const hasOnKillRelic =
    w.relics.includes("ACT_EXPLODE_ON_KILL")
    || w.relics.includes("ACT_DAGGER_ON_KILL_50")
    || w.relics.includes("ACT_IGNITE_SPREAD_ON_DEATH")
    || w.relics.includes("ARMOR_RESTORE_ON_KILL_10");
  if (!hasOnKillRelic) return;
  if (!Array.isArray(w.events) || w.events.length === 0) return;
  const hasTriggerEcho = w.relics.includes("ACT_TRIGGERS_DOUBLE");

  const eventCount = w.events.length;
  for (let ei = 0; ei < eventCount; ei++) {
    const ev = w.events[ei];
    if (ev.type !== "ENEMY_KILLED") continue;
    if (ev.source === "OTHER") continue; // loop guard
    const triggerEv: RelicTriggerEvent = {
      ...ev,
      killDamage: findKillingBlowDamage(w.events, ei, ev.enemyIndex),
    };
    dispatchRelicTriggers(w, triggerEv);
    if (hasTriggerEcho && !triggerEv.isRetrigger) {
      w.relicRetriggerQueue.push({
        fireAt: w.time + RELIC_RETRIGGER_DELAY_SEC,
        event: {
          ...triggerEv,
          isRetrigger: true,
        },
      });
    }
  }
}
