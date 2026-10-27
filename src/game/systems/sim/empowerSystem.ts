// @system   core-simulation/combat-runtime
// @owns     manage timed (Heavy Chamber) and kill-triggered (Kill Momentum) next-shot empowerment
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no weapon fire cadence or projectile spawning; see combat.ts

import type { World } from "../../../engine/world/world";
import { isProcDamage } from "../../combat/damageMeta";
import type { CombatRulesSnapshot } from "../../progression/effects/combatRules";

type NextShotEmpowerState = {
  timedCooldown: number;
  empoweredPhysIncreased: number;
  empoweredAllIncreased: number;
};

function getState(w: World): NextShotEmpowerState | undefined {
  return (w as any)._nextShotEmpower;
}

function ensureState(w: World, combatRules: CombatRulesSnapshot): NextShotEmpowerState {
  return ((w as any)._nextShotEmpower ??= {
    timedCooldown: combatRules.timedNextShotEmpower?.chargeEvery ?? 0,
    empoweredPhysIncreased: 0,
    empoweredAllIncreased: 0,
  });
}

export function tickNextShotEmpower(w: World, dt: number, combatRules: CombatRulesSnapshot): void {
  if (!combatRules.timedNextShotEmpower && !combatRules.killEmpowerNextShot) return;

  const state = ensureState(w, combatRules);

  // Timed recharge (Heavy Chamber)
  if (combatRules.timedNextShotEmpower) {
    state.timedCooldown -= dt;
    if (state.timedCooldown <= 0) {
      state.timedCooldown += combatRules.timedNextShotEmpower.chargeEvery;
      state.empoweredPhysIncreased = combatRules.timedNextShotEmpower.physicalDamageIncreased;
    }
  }

  // Kill empower (Kill Momentum) — scan events for player kills
  if (combatRules.killEmpowerNextShot) {
    for (const event of w.events) {
      if (event.type !== "ENEMY_KILLED") continue;
      if ((event as any).damageMeta?.instigator?.actor !== "PLAYER") continue;
      if (isProcDamage((event as any).damageMeta)) continue;
      state.empoweredAllIncreased = combatRules.killEmpowerNextShot.damageIncreased;
      break;
    }
  }
}

export function consumeNextShotEmpower(w: World): { physIncreased: number; allIncreased: number } {
  const state = getState(w);
  if (!state) return { physIncreased: 0, allIncreased: 0 };
  const result = {
    physIncreased: state.empoweredPhysIncreased,
    allIncreased: state.empoweredAllIncreased,
  };
  state.empoweredPhysIncreased = 0;
  state.empoweredAllIncreased = 0;
  return result;
}
