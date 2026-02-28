import type { PlayableCharacterId } from "../../../content/playableCharacters";
import type { CombatStarterWeaponId } from "./starterWeapons";

const CHARACTER_COMBAT_STARTER_WEAPON: Partial<Record<PlayableCharacterId, CombatStarterWeaponId>> = {
  HOBO: "HOBO_SYRINGE_V1",
  JACK: "JACK_PISTOL_V1",
  JAMAL: "JAMAL_THROWING_KNIFE_V1",
  JOEY: "JOEY_RIFLE_V1",
  TOMMY: "TOMMY_SHOTGUN_V1",
};

export function resolveCombatStarterWeaponId(characterId?: string): CombatStarterWeaponId {
  if (!characterId) return "JACK_PISTOL_V1";
  const mapped = CHARACTER_COMBAT_STARTER_WEAPON[characterId as PlayableCharacterId];
  return mapped ?? "JACK_PISTOL_V1";
}
