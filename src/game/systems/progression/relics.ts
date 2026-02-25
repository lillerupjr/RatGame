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
  moveSpeedBonus?: number;
  dmgMult?: number;
  critRolls?: 1 | 2;
};

export function getRelicMods(world: World): RelicMods {
  normalizeWorldRelics(world);
  const hasMoveRelic = world.relics.includes("PASS_MOVE_SPEED_20");
  const hasLuckyCrit = world.relics.includes("PASS_CRIT_ROLLS_TWICE");
  return {
    moveSpeedBonus: hasMoveRelic ? world.baseMoveSpeed * 0.2 : 0,
    dmgMult: 1,
    critRolls: hasLuckyCrit ? 2 : 1,
  };
}
