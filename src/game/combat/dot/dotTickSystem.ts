// @system   core-simulation/combat-runtime
// @owns     dispatch fixed-cadence ailment, zone, and beam DOT ticks
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no individual DOT effect math; see ailmentTickSystem.ts, zones.ts, and beamCombat.ts

import type { World } from "../../../engine/world/world";
import { DOT_TICK_INTERVAL_SEC } from "./dotConstants";
import { tickAilmentsOnce } from "../../combat_mods/systems/ailmentTickSystem";
import { tickZonesOnce } from "../../systems/sim/zones";
import { tickBeamContactsOnce } from "../../systems/sim/beamCombat";
import { tickPoisonZones } from "../../systems/sim/poisonTrail";

export function dotTickSystem(w: World, dt: number): void {
  w.dotTickAcc = Math.max(0, w.dotTickAcc ?? 0) + Math.max(0, dt);

  while (w.dotTickAcc >= DOT_TICK_INTERVAL_SEC) {
    w.dotTickAcc -= DOT_TICK_INTERVAL_SEC;
    tickAilmentsOnce(w, DOT_TICK_INTERVAL_SEC);
    tickZonesOnce(w, DOT_TICK_INTERVAL_SEC);
    tickPoisonZones(w, DOT_TICK_INTERVAL_SEC);
    tickBeamContactsOnce(w, DOT_TICK_INTERVAL_SEC);
  }
}
