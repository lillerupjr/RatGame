import type { World } from "../../../engine/world/world";
import { normalizeWorldRelics } from "../progression/relics";
import type { RelicTriggerEvent } from "../../events";
import { dispatchRelicTriggers, RELIC_RETRIGGER_DELAY_SEC } from "../progression/relicTriggerSystem";

export function relicExplodeOnKillSystem(w: World, _dt: number): void {
  normalizeWorldRelics(w);
  if (!w.relics.includes("ACT_EXPLODE_ON_KILL")) return;
  if (!Array.isArray(w.events) || w.events.length === 0) return;
  const hasTriggerEcho = w.relics.includes("ACT_TRIGGERS_DOUBLE");

  const eventCount = w.events.length;
  for (let ei = 0; ei < eventCount; ei++) {
    const ev = w.events[ei];
    if (ev.type !== "ENEMY_KILLED") continue;
    if (ev.source === "OTHER") continue; // loop guard
    const triggerEv: RelicTriggerEvent = ev;
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
