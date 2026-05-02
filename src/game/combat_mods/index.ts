// @system   combat-mods/stat-resolution-loadout-effects
// @owns     re-export combat-mod weapon, stat, and debug modules
// @doc      docs/canonical/combat_mods_stat_resolution_loadout_effects.md
// @agents   no implementation logic lives here; follow the re-export target module instead

export * from "./content/weapons/jackPistol";
export * from "./content/weapons/hoboSyringe";
export * from "./content/weapons/jamalThrowingKnife";
export * from "./content/weapons/joeyRifle";
export * from "./content/weapons/tommyShotgun";
export * from "./content/weapons/starterWeapons";
export * from "./content/weapons/characterStarterMap";
export * from "./stats/combatStatsResolver";
export * from "./stats/modifierTypes";
export * from "./stats/statKeys";
export * from "./debug/combatModsSnapshot";
export * from "./debug/combatRuntimeAssert";
