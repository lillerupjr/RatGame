// src/game/stats/derivedStats.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { STAT_KEYS, type StatKey } from "../combat_mods/stats/statKeys";
import type { StatMod } from "../progression/effects/effectTypes";
import { collectWorldStatMods } from "../progression/effects/worldEffects";
import { resolveScalarPipeline } from "./playerStatPipeline";

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function sumMods(mods: readonly StatMod[], key: StatKey, op: StatMod["op"]): number {
  let total = 0;
  for (const mod of mods) {
    if (mod.key === key && mod.op === op) total += mod.value;
  }
  return total;
}

function present(value: number): number[] {
  return value !== 0 ? [value] : [];
}

/**
 * Recompute all derived global player stats from base stats, item effects,
 * and centralized ring progression effects.
 */
export function recomputeDerivedStats(w: World) {
  const prevCurrentArmor = Number.isFinite(w.currentArmor) ? w.currentArmor : 0;

  w.pSpeed = w.baseMoveSpeed;
  w.pickupRadius = w.basePickupRadius;
  w.maxArmor = 50;
  w.momentumMax = 20;

  w.dmgMult = 1;
  w.fireRateMult = 1;
  w.areaMult = 1;
  w.durationMult = 1;
  w.critChanceBonus = 0;

  for (const inst of w.items) {
    const def = registry.item(inst.id);
    def.apply(w, inst.level);
  }

  const itemDamageMoreFactor = Math.max(0, finite(w.dmgMult, 1));
  const itemAttackSpeedMoreFactor = Math.max(0, finite(w.fireRateMult, 1));
  const itemMoveSpeedFlat = finite(w.pSpeed, w.baseMoveSpeed) - w.baseMoveSpeed;
  const mods = collectWorldStatMods(w);

  w.dmgMult = 1;
  w.fireRateMult = 1;
  w.pSpeed = w.baseMoveSpeed;

  const lifeAdd = sumMods(mods, STAT_KEYS.LIFE_ADD, "add");
  w.playerHpMax = resolveScalarPipeline({
    base: finite(w.basePlayerHpMax, 0),
    flatAdds: present(Math.max(0, lifeAdd)),
    flatSubs: present(Math.max(0, -lifeAdd)),
    increased: present(sumMods(mods, STAT_KEYS.LIFE_INCREASED, "increased")),
    decreased: present(sumMods(mods, STAT_KEYS.LIFE_DECREASED, "decreased")),
    more: present(sumMods(mods, STAT_KEYS.LIFE_MORE, "more")),
    less: present(sumMods(mods, STAT_KEYS.LIFE_LESS, "less")),
    min: 1,
    rounding: "floor",
  });

  w.momentumMax = Math.max(0, w.momentumMax);
  w.momentumValue = Math.max(0, Math.min(w.momentumMax, Number.isFinite(w.momentumValue) ? w.momentumValue : 0));

  w.dmgMult = resolveScalarPipeline({
    base: 1,
    flatAdds: present(sumMods(mods, STAT_KEYS.GLOBAL_HIT_DAMAGE_ADD, "add")),
    flatSubs: [],
    increased: present(sumMods(mods, STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED, "increased")),
    decreased: [],
    more: present((itemDamageMoreFactor !== 1 ? itemDamageMoreFactor - 1 : 0) + sumMods(mods, STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, "more")),
    less: present(sumMods(mods, STAT_KEYS.GLOBAL_HIT_DAMAGE_LESS, "less")),
    min: 0,
    rounding: "none",
  });

  w.fireRateMult = resolveScalarPipeline({
    base: 1,
    flatAdds: present(sumMods(mods, STAT_KEYS.GLOBAL_ATTACK_SPEED_ADD, "add")),
    flatSubs: [],
    increased: present(sumMods(mods, STAT_KEYS.GLOBAL_ATTACK_SPEED_INCREASED, "increased")),
    decreased: [],
    more: present((itemAttackSpeedMoreFactor !== 1 ? itemAttackSpeedMoreFactor - 1 : 0) + sumMods(mods, STAT_KEYS.GLOBAL_ATTACK_SPEED_MORE, "more")),
    less: present(sumMods(mods, STAT_KEYS.GLOBAL_ATTACK_SPEED_LESS, "less")),
    min: 0,
    rounding: "none",
  });

  const moveFlat = itemMoveSpeedFlat + sumMods(mods, STAT_KEYS.MOVE_SPEED_ADD, "add");
  w.pSpeed = resolveScalarPipeline({
    base: finite(w.baseMoveSpeed, 0),
    flatAdds: present(Math.max(0, moveFlat)),
    flatSubs: present(Math.max(0, -moveFlat)),
    increased: present(sumMods(mods, STAT_KEYS.MOVE_SPEED_INCREASED, "increased")),
    decreased: [],
    more: present(sumMods(mods, STAT_KEYS.MOVE_SPEED_MORE, "more")),
    less: present(sumMods(mods, STAT_KEYS.MOVE_SPEED_LESS, "less")),
    min: 0,
    rounding: "none",
  });

  w.playerHp = Math.min(w.playerHp, w.playerHpMax);
  w.currentArmor = prevCurrentArmor;
  w.maxArmor = Math.max(0, w.maxArmor);
  w.currentArmor = Math.max(0, Math.min(w.maxArmor, w.currentArmor));
}
