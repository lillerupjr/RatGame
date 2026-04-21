import { resolveWeaponStats, type ResolvedWeaponStats } from "../stats/combatStatsResolver";
import { resolveCombatStarterWeaponId } from "../content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../content/weapons/starterWeapons";
import { collectWorldStatMods } from "../../progression/effects/worldEffects";

export interface ModifierCountEntry {
  id: string;
  name: string;
  count: number;
  rarity?: 1 | 2 | 3 | 4;
  powerTier?: 1 | 2 | 3 | 4 | 5;
}

export interface CombatModsSnapshot {
  modifiers: ModifierCountEntry[];
  weaponStats: ResolvedWeaponStats;
}

export function aggregateModifierCounts(modifierIds: string[]): ModifierCountEntry[] {
  const counts = new Map<string, number>();
  for (const id of modifierIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  const entries: ModifierCountEntry[] = [];
  for (const [id, count] of counts.entries()) {
    entries.push({
      id,
      name: id,
      count,
    });
  }

  // Stable ordering: rarity desc, then name asc, then id asc.
  entries.sort((a, b) => {
    const ra = a.rarity ?? 0;
    const rb = b.rarity ?? 0;
    if (ra !== rb) return rb - ra;
    const na = a.name.toLowerCase();
    const nb = b.name.toLowerCase();
    if (na !== nb) return na < nb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return entries;
}

export function getCombatModsSnapshot(world: any): CombatModsSnapshot {
  const starterWeaponId = resolveCombatStarterWeaponId(world?.currentCharacterId);
  const starterWeapon = getCombatStarterWeaponById(starterWeaponId);

  const weaponStats = resolveWeaponStats(starterWeapon, { statMods: collectWorldStatMods(world) });

  return { modifiers: [], weaponStats };
}
