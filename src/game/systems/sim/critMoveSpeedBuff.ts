// @system   core-simulation/combat-runtime
// @owns     grant temporary movement speed buff on player crit
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no stat pipeline resolution; see derivedStats.ts

import type { World } from "../../../engine/world/world";
import { isProcDamage } from "../../combat/damageMeta";
import type { CombatRulesSnapshot } from "../../progression/effects/combatRules";

type CritMoveSpeedBuffState = {
  tLeft: number;
  increased: number;
};

export function tickCritMoveSpeedBuff(w: World, dt: number, combatRules: CombatRulesSnapshot): void {
  if (!combatRules.critMoveSpeedBuff) return;

  const state: CritMoveSpeedBuffState = ((w as any)._critMoveSpeedBuff ??= { tLeft: 0, increased: 0 });

  // Scan events for player crits to refresh buff
  for (const event of w.events) {
    if (event.type !== "ENEMY_HIT") continue;
    if (!(event as any).isCrit) continue;
    if ((event as any).damageMeta?.instigator?.actor !== "PLAYER") continue;
    if (isProcDamage((event as any).damageMeta)) continue;
    state.tLeft = combatRules.critMoveSpeedBuff.durationSec;
    state.increased = combatRules.critMoveSpeedBuff.moveSpeedIncreased;
    break;
  }

  // Decrement timer
  if (state.tLeft > 0) {
    state.tLeft = Math.max(0, state.tLeft - dt);
  }
}
