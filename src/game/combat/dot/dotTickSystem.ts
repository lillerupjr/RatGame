import type { World } from "../../../engine/world/world";
import { DOT_TICK_INTERVAL_SEC } from "./dotConstants";
import { tickAilmentsOnce } from "../../combat_mods/systems/ailmentTickSystem";
import { tickZonesOnce } from "../../systems/sim/zones";
import { tickBeamContactsOnce } from "../../systems/sim/beamCombat";

export function dotTickSystem(w: World, dt: number): void {
  w.dotTickAcc = Math.max(0, w.dotTickAcc ?? 0) + Math.max(0, dt);

  while (w.dotTickAcc >= DOT_TICK_INTERVAL_SEC) {
    w.dotTickAcc -= DOT_TICK_INTERVAL_SEC;
    tickAilmentsOnce(w, DOT_TICK_INTERVAL_SEC);
    tickZonesOnce(w, DOT_TICK_INTERVAL_SEC);
    tickBeamContactsOnce(w, DOT_TICK_INTERVAL_SEC);
  }
}

