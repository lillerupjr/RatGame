import type { StatMod } from "../../progression/effects/effectTypes";

export type { ModOp, StatMod } from "../../progression/effects/effectTypes";

export interface ModifierDef {
  id: string;
  isEnabled: boolean;
  displayName: string;
  rarity: 1 | 2 | 3 | 4;
  powerTier: 1 | 2 | 3 | 4 | 5;
  tags: ModifierTag[];
  mods: StatMod[];
}

export type DamageType = "physical" | "fire" | "chaos";

export interface DamageBundle {
  physical: number;
  fire: number;
  chaos: number;
}

export type WeaponTag =
  | "weapon"
  | "gun"
  | "fires"
  | "projectile"
  | "hit"
  | "crit"
  | "dot"
  | "beam"
  | "single_shot"
  // damage identity
  | "physical"
  | "fire"
  | "chaos"
  // ailment identity
  | "bleed"
  | "ignite"
  | "poison";

export type ModifierTag =
  | "gun"
  | "fires"
  | "projectile"
  | "hit"
  | "crit"
  | "dot"
  | "beam"
  | "physical"
  | "fire"
  | "chaos"
  | "bleed"
  | "ignite"
  | "poison"
  // survivability
  | "life"
  | "defense";

export interface WeaponBeamDef {
  maxRangePx: number;
  dps: number;
  widthPx: number;
  glowIntensity: number;
  uvScrollSpeed: number;
}

export interface WeaponDef {
  id: string;
  displayName: string;
  tags: WeaponTag[];

  shotsPerSecond: number;

  baseDamage: DamageBundle;
  baseCritChance: number; // 0..1
  baseCritMulti: number; // e.g. 1.5
  baseChanceToBleed?: number; // 0..1
  baseChanceToIgnite?: number; // 0..1
  baseChanceToPoison?: number; // 0..1
  fireMode?: "projectile" | "beam";
  beam?: WeaponBeamDef;

  projectile: {
    // Projectile kind routed into the shared projectile/sprite/audio pipeline.
    // Defaults to pistol when omitted.
    kind?: number;
    speedPxPerSec: number;
    rangePx: number;
    radiusPx: number;
    spreadBaseDeg: number;
    // Fan width for additional projectiles when count > 1.
    // Weapon-authored only in milestone 1.
    multiProjectileSpreadDeg?: number;
    // Optional delay between burst shots for weapons that fire additional projectiles sequentially.
    burstShotIntervalSec?: number;
    pierce: number;
    // Base projectile count before additive modifiers.
    baseProjectiles?: number;
  };

  autoAim: {
    maxRangePx: number;
    mode: "nearest";
  };
}
