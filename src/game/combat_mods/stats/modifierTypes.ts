import type { StatKey } from "./statKeys";

export type ModOp = "add" | "increased" | "decreased" | "more" | "less";

/**
 * A single stat modifier.
 *
 * Conventions:
 * - "add" is raw addition to a base stat (e.g. +3 fire damage, +0.04 crit chance).
 * - "increased"/"decreased" are additive scaling (sum bucket), expressed as fraction (0.15 = +15%).
 * - "more"/"less" are multiplicative scaling, expressed as fraction (0.20 = 20% more => *1.2).
 */
export interface StatMod {
  key: StatKey;
  op: ModOp;
  value: number;
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
  // ailment identity (used for stat-tag filtering)
  | "bleed"
  | "ignite"
  | "poison";

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
    // Base projectile count before additive stat modifiers.
    baseProjectiles?: number;
  };

  autoAim: {
    maxRangePx: number;
    mode: "nearest";
  };
}
