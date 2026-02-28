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
