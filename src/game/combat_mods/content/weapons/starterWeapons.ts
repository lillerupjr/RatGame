// @system   combat-mods/stat-resolution-loadout-effects
// @owns     register starter weapon definitions and resolve them by id
// @doc      docs/canonical/combat_mods_stat_resolution_loadout_effects.md
// @agents   no character-to-weapon mapping or stat resolution; see characterStarterMap.ts and combatStatsResolver.ts

import type { WeaponDef } from "../../stats/modifierTypes";
import { HOBO_SYRINGE_V1 } from "./hoboSyringe";
import { JACK_PISTOL_V1 } from "./jackPistol";
import { JAMAL_THROWING_KNIFE_V1 } from "./jamalThrowingKnife";
import { JOEY_RIFLE_V1 } from "./joeyRifle";
import { TOMMY_SHOTGUN_V1 } from "./tommyShotgun";

export type CombatStarterWeaponId =
  | "JACK_PISTOL_V1"
  | "HOBO_SYRINGE_V1"
  | "JAMAL_THROWING_KNIFE_V1"
  | "JOEY_RIFLE_V1"
  | "TOMMY_SHOTGUN_V1";

export const COMBAT_STARTER_WEAPONS: Record<CombatStarterWeaponId, WeaponDef> = {
  JACK_PISTOL_V1,
  HOBO_SYRINGE_V1,
  JAMAL_THROWING_KNIFE_V1,
  JOEY_RIFLE_V1,
  TOMMY_SHOTGUN_V1,
};

export function getCombatStarterWeaponById(id: CombatStarterWeaponId): WeaponDef {
  return COMBAT_STARTER_WEAPONS[id];
}
