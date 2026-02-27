import type { World } from "../../../engine/world/world";
import { normalizeRelicIdList, toCanonicalRelicId } from "../../content/relics";
import { recomputeDerivedStats } from "../../stats/derivedStats";

export function normalizeWorldRelics(world: World): void {
  const normalized = normalizeRelicIdList(world.relics);
  if (normalized.length !== world.relics.length) {
    world.relics = normalized;
    return;
  }
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] !== world.relics[i]) {
      world.relics = normalized;
      return;
    }
  }
}

export function applyRelic(world: World, relicId: string): void {
  normalizeWorldRelics(world);
  const canonical = toCanonicalRelicId(relicId);
  if (world.relics.includes(canonical)) return;
  world.relics = [...world.relics, canonical];
  recomputeDerivedStats(world);
}

export type RelicMods = {
  moveSpeedMult?: number;
  dmgMult?: number;
  critRolls?: 1 | 2;
  moreDamage?: number;
  lessDamage?: number;
  moreAttackSpeed?: number;
  lessAttackSpeed?: number;
  lessMaxLife?: number;
  flatMaxArmor?: number;
  lessMoveSpeed?: number;
};

export function getRelicMods(world: World): RelicMods {
  normalizeWorldRelics(world);
  const hasMoveRelic = world.relics.includes("PASS_MOVE_SPEED_20");
  const hasLuckyCrit = world.relics.includes("PASS_CRIT_ROLLS_TWICE");
  const hasSpecDamageMore100AttackLess40 = world.relics.includes("SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40");
  const hasSpecAttackMore50DamageLess30 = world.relics.includes("SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30");
  const hasSpecDamageMore200LifeLess50 = world.relics.includes("SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50");
  const hasSpecArmor100MoveLess20 = world.relics.includes("SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20");
  return {
    moveSpeedMult: hasMoveRelic ? 1.2 : 1,
    dmgMult: 1,
    critRolls: hasLuckyCrit ? 2 : 1,
    moreDamage:
      (hasSpecDamageMore100AttackLess40 ? 1.0 : 0) +
      (hasSpecDamageMore200LifeLess50 ? 2.0 : 0),
    lessDamage: hasSpecAttackMore50DamageLess30 ? 0.3 : 0,
    moreAttackSpeed: hasSpecAttackMore50DamageLess30 ? 0.5 : 0,
    lessAttackSpeed: hasSpecDamageMore100AttackLess40 ? 0.4 : 0,
    lessMaxLife: hasSpecDamageMore200LifeLess50 ? 0.5 : 0,
    flatMaxArmor: hasSpecArmor100MoveLess20 ? 100 : 0,
    lessMoveSpeed: hasSpecArmor100MoveLess20 ? 0.2 : 0,
  };
}
