import type { PlayableCharacterId } from "../../../content/playableCharacters";
import { STAT_KEYS } from "../../stats/statKeys";
import type { StatMod } from "../../stats/modifierTypes";

const JAMAL_STARTER_PROJECTILE_MODS: readonly StatMod[] = [
  { key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 },
];

const CHARACTER_STARTER_MODS: Partial<Record<PlayableCharacterId, readonly StatMod[]>> = {
  JAMAL: JAMAL_STARTER_PROJECTILE_MODS,
};

export function resolveCombatStarterStatMods(characterId?: string): readonly StatMod[] {
  if (!characterId) return [];
  return CHARACTER_STARTER_MODS[characterId as PlayableCharacterId] ?? [];
}
