import { STAT_KEYS, type StatKey } from "./statKeys";
import type { CardDef, DamageBundle, StatMod, WeaponDef } from "./modifierTypes";
import { applyConversionPriorityFill } from "../damage/conversion";

export interface ResolvedWeaponStats {
  shotsPerSecond: number;

  // after flat adds + conversion + increased/more; crit is not applied here
  baseDamage: DamageBundle;
  critChance: number; // 0..1
  critMulti: number; // e.g. 1.5

  spreadBaseDeg: number;
  multiProjectileSpreadDeg: number;

  projectileSpeedPxPerSec: number;
  rangePx: number;
  radiusPx: number;
  projectiles: number;
  pierce: number;

  // Ailment chances (0..1)
  chanceToBleed: number;
  chanceToIgnite: number;
  chanceToPoison: number;

  // Conversion (clamped 0..1)
  convert: {
    physToFire: number;
    physToChaos: number;
    fireToChaos: number;
  };
}

export interface CombatModsLoadout {
  cards: CardDef[];
  // later: relics, buffs, debuffs
}

export interface DotStatsScalars {
  poisonDamageMult: number;
  igniteDamageMult: number;
  dotDurationMult: number;
  tickRateMult: number;
}

/**
 * Collect mods from a loadout. (Phase A: cards only)
 */
export function collectStatMods(loadout: CombatModsLoadout): StatMod[] {
  const mods: StatMod[] = [];
  for (const c of loadout.cards) mods.push(...c.mods);
  return mods;
}

type Acc = {
  add: number;
  inc: number; // sum of increased
  more: number; // multiplicative factor, starts at 1
};

function newAcc(): Acc {
  return { add: 0, inc: 0, more: 1 };
}

function applyMod(acc: Acc, mod: StatMod): void {
  if (mod.op === "add") acc.add += mod.value;
  else if (mod.op === "increased") acc.inc += mod.value;
  else if (mod.op === "more") acc.more *= 1 + mod.value;
}

/**
 * Resolve a single numeric stat from a base value and a stat accumulator.
 * Formula: (base + add) * (1 + inc) * more
 */
function resolveScalar(base: number, acc: Acc): number {
  return (base + acc.add) * (1 + acc.inc) * acc.more;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function combineAcc(...accs: Acc[]): Acc {
  let add = 0;
  let inc = 0;
  let more = 1;
  for (const acc of accs) {
    add += acc.add;
    inc += acc.inc;
    more *= acc.more;
  }
  return { add, inc, more };
}

export function resolveWeaponStats(weapon: WeaponDef, loadout: CombatModsLoadout): ResolvedWeaponStats {
  const mods = collectStatMods(loadout);

  const accByKey = new Map<StatKey, Acc>();
  const getAcc = (k: StatKey): Acc => {
    let a = accByKey.get(k);
    if (!a) {
      a = newAcc();
      accByKey.set(k, a);
    }
    return a;
  };

  for (const m of mods) {
    applyMod(getAcc(m.key), m);
  }

  const spsAcc = combineAcc(
    getAcc(STAT_KEYS.SHOTS_PER_SECOND_INCREASED),
    getAcc(STAT_KEYS.SHOTS_PER_SECOND_MORE)
  );
  const sps = resolveScalar(weapon.shotsPerSecond, spsAcc);

  const critChance = clamp01(weapon.baseCritChance + getAcc(STAT_KEYS.CRIT_CHANCE_ADD).add);
  const critMulti = Math.max(1, weapon.baseCritMulti + getAcc(STAT_KEYS.CRIT_MULTI_ADD).add);

  const spreadBaseDeg = Math.max(0, weapon.projectile.spreadBaseDeg + getAcc(STAT_KEYS.SPREAD_BASE_DEG_ADD).add);
  const multiProjectileSpreadDeg = Math.max(
    0,
    weapon.projectile.multiProjectileSpreadDeg ?? weapon.projectile.spreadBaseDeg,
  );

  const projectileSpeedPxPerSec = resolveScalar(
    weapon.projectile.speedPxPerSec,
    getAcc(STAT_KEYS.PROJECTILE_SPEED_INCREASED)
  );

  const baseProjectiles = Math.max(1, Math.floor(weapon.projectile.baseProjectiles ?? 1));
  const projectiles = Math.max(1, Math.floor(baseProjectiles + getAcc(STAT_KEYS.PROJECTILES_ADD).add));
  const pierce = Math.max(0, Math.floor(weapon.projectile.pierce + getAcc(STAT_KEYS.PIERCE_ADD).add));

  const conv = {
    physToFire: clamp01(getAcc(STAT_KEYS.CONVERT_PHYS_TO_FIRE).add),
    physToChaos: clamp01(getAcc(STAT_KEYS.CONVERT_PHYS_TO_CHAOS).add),
    fireToChaos: clamp01(getAcc(STAT_KEYS.CONVERT_FIRE_TO_CHAOS).add),
  };

  const baseBeforeConv: DamageBundle = {
    physical: weapon.baseDamage.physical + getAcc(STAT_KEYS.DAMAGE_ADD_PHYSICAL).add,
    fire: weapon.baseDamage.fire + getAcc(STAT_KEYS.DAMAGE_ADD_FIRE).add,
    chaos: weapon.baseDamage.chaos + getAcc(STAT_KEYS.DAMAGE_ADD_CHAOS).add,
  };

  const afterConv = applyConversionPriorityFill(baseBeforeConv, conv);

  const damageIncreased = getAcc(STAT_KEYS.DAMAGE_INCREASED).inc;
  const damageMore = getAcc(STAT_KEYS.DAMAGE_MORE).more;
  const damageScale = (1 + damageIncreased) * damageMore;

  const baseDamage: DamageBundle = {
    physical: afterConv.physical * damageScale,
    fire: afterConv.fire * damageScale,
    chaos: afterConv.chaos * damageScale,
  };

  const chanceToBleed = clamp01((weapon.baseChanceToBleed ?? 0) + getAcc(STAT_KEYS.CHANCE_TO_BLEED_ADD).add);
  const chanceToIgnite = clamp01((weapon.baseChanceToIgnite ?? 0) + getAcc(STAT_KEYS.CHANCE_TO_IGNITE_ADD).add);
  const chanceToPoison = clamp01((weapon.baseChanceToPoison ?? 0) + getAcc(STAT_KEYS.CHANCE_TO_POISON_ADD).add);

  return {
    shotsPerSecond: sps,
    baseDamage,
    critChance,
    critMulti,
    spreadBaseDeg,
    multiProjectileSpreadDeg,
    projectileSpeedPxPerSec,
    rangePx: weapon.projectile.rangePx,
    radiusPx: weapon.projectile.radiusPx,
    projectiles,
    pierce,
    chanceToBleed,
    chanceToIgnite,
    chanceToPoison,
    convert: conv,
  };
}

export function resolveDotStats(loadout: CombatModsLoadout): DotStatsScalars {
  const mods = collectStatMods(loadout);
  const accByKey = new Map<StatKey, Acc>();
  const getAcc = (k: StatKey): Acc => {
    let a = accByKey.get(k);
    if (!a) {
      a = newAcc();
      accByKey.set(k, a);
    }
    return a;
  };
  for (const m of mods) {
    applyMod(getAcc(m.key), m);
  }

  const poisonAcc = getAcc(STAT_KEYS.DOT_POISON_DAMAGE_INCREASED);
  const igniteAcc = getAcc(STAT_KEYS.DOT_IGNITE_DAMAGE_INCREASED);
  const durationAcc = getAcc(STAT_KEYS.DOT_DURATION_INCREASED);
  const tickRateAcc = getAcc(STAT_KEYS.DOT_TICK_RATE_MORE);

  const poisonDamageMult = Math.max(0, (1 + poisonAcc.inc) * poisonAcc.more);
  const igniteDamageMult = Math.max(0, (1 + igniteAcc.inc) * igniteAcc.more);
  const dotDurationMult = Math.max(0, (1 + durationAcc.inc) * durationAcc.more);
  const tickRateMult = Math.max(0.0001, (1 + tickRateAcc.inc) * tickRateAcc.more);

  return {
    poisonDamageMult,
    igniteDamageMult,
    dotDurationMult,
    tickRateMult,
  };
}
