import type { StatKey } from "./statKeys";

export type ModOp = "add" | "increased" | "more";

/**
 * A single stat modifier.
 *
 * Conventions:
 * - "add" is raw addition to a base stat (e.g. +3 fire damage, +0.04 crit chance).
 * - "increased" is additive scaling (sum bucket), expressed as fraction (0.15 = +15%).
 * - "more" is multiplicative scaling, expressed as fraction (0.20 = 20% more => *1.2).
 */
export interface StatMod {
  key: StatKey;
  op: ModOp;
  value: number;
}

export interface CardDef {
  id: string; // generic for now
  isEnabled: boolean;
  displayName: string; // generic for now
  rarity: 1 | 2 | 3 | 4;
  powerTier: 1 | 2 | 3 | 4 | 5;
  mods: StatMod[];
}

export type DamageType = "physical" | "fire" | "chaos";

export interface DamageBundle {
  physical: number;
  fire: number;
  chaos: number;
}

export type WeaponTag = "weapon" | "gun" | "projectile" | "hit" | "single_shot";

export interface WeaponDef {
  id: string;
  displayName: string;
  tags: WeaponTag[];

  shotsPerSecond: number;

  baseDamage: DamageBundle;
  baseCritChance: number; // 0..1
  baseCritMulti: number; // e.g. 1.5

  projectile: {
    speedPxPerSec: number;
    rangePx: number;
    radiusPx: number;
    spreadBaseDeg: number;
    pierce: number;
  };

  autoAim: {
    maxRangePx: number;
    mode: "nearest";
  };
}
