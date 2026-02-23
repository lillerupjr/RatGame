import { JACK_PISTOL_V1 } from "../content/weapons/jackPistol";
import { getStarterCardById } from "../content/cards/starterCards";
import { resolveWeaponStats, type ResolvedWeaponStats } from "../stats/combatStatsResolver";
import type { CardDef } from "../stats/modifierTypes";

export interface CardCountEntry {
  id: string;
  name: string;
  count: number;
  rarity?: 1 | 2 | 3 | 4;
}

export interface CombatModsSnapshot {
  cards: CardCountEntry[];
  weaponStats: ResolvedWeaponStats;
}

function readCardIdsFromWorld(w: any): string[] {
  const ids =
    (Array.isArray(w?.cards) && w.cards) ||
    (Array.isArray(w?.runCards) && w.runCards) ||
    (Array.isArray(w?.pickedCards) && w.pickedCards) ||
    [];
  return ids.filter((x: any) => typeof x === "string");
}

export function aggregateCardCounts(cardIds: string[]): CardCountEntry[] {
  const counts = new Map<string, number>();
  for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  const entries: CardCountEntry[] = [];
  for (const [id, count] of counts.entries()) {
    const def = getStarterCardById(id);
    entries.push({
      id,
      name: def?.displayName ?? id,
      count,
      rarity: def?.rarity,
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

function cardDefsFromIds(cardIds: string[]): CardDef[] {
  const defs: CardDef[] = [];
  for (const id of cardIds) {
    const d = getStarterCardById(id);
    if (d) defs.push(d);
  }
  return defs;
}

export function getCombatModsSnapshot(world: any): CombatModsSnapshot {
  const cardIds = readCardIdsFromWorld(world);
  const cards = aggregateCardCounts(cardIds);
  const defs = cardDefsFromIds(cardIds);

  const weaponStats = resolveWeaponStats(JACK_PISTOL_V1, { cards: defs });

  return { cards, weaponStats };
}
