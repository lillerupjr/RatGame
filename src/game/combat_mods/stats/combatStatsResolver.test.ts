import { describe, expect, test } from "vitest";
import { resolveDotStats, resolveWeaponStats } from "./combatStatsResolver";
import { HOBO_SYRINGE_V1 } from "../content/weapons/hoboSyringe";
import { JACK_PISTOL_V1 } from "../content/weapons/jackPistol";
import { JAMAL_THROWING_KNIFE_V1 } from "../content/weapons/jamalThrowingKnife";
import { JOEY_RIFLE_V1 } from "../content/weapons/joeyRifle";
import { TOMMY_SHOTGUN_V1 } from "../content/weapons/tommyShotgun";
import { STAT_KEYS } from "./statKeys";
import type { ModifierDef, StatMod } from "./modifierTypes";

function mkModifier(id: string, mods: StatMod[]): ModifierDef {
  return { id, isEnabled: true, displayName: id, rarity: 1, powerTier: 1, tags: ["gun"], mods };
}

describe("resolveWeaponStats", () => {
  test("baseline pistol resolves stable defaults", () => {
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [] });

    expect(out.shotsPerSecond).toBeCloseTo(2.0);
    expect(out.baseDamage.physical).toBeCloseTo(12);
    expect(out.baseDamage.fire).toBeCloseTo(0);
    expect(out.baseDamage.chaos).toBeCloseTo(0);

    expect(out.critChance).toBeCloseTo(0.05);
    expect(out.critMulti).toBeCloseTo(1.5);

    expect(out.spreadBaseDeg).toBeCloseTo(3.0);
    expect(out.multiProjectileSpreadDeg).toBeCloseTo(3.0);
    expect(out.projectiles).toBe(1);
    expect(out.pierce).toBe(0);

    expect(out.chanceToBleed).toBeCloseTo(0);
    expect(out.chanceToIgnite).toBeCloseTo(0);
    expect(out.chanceToPoison).toBeCloseTo(0);

    expect(out.convert.physToFire).toBeCloseTo(0);
    expect(out.convert.physToChaos).toBeCloseTo(0);
    expect(out.convert.fireToChaos).toBeCloseTo(0);
  });

  test("baseline laser resolves 1x24 fire profile and longer-range projectile", () => {
    const out = resolveWeaponStats(JOEY_RIFLE_V1, { modifiers: [] });

    expect(out.shotsPerSecond).toBeCloseTo(1.0);
    expect(out.baseDamage.physical).toBeCloseTo(0);
    expect(out.baseDamage.fire).toBeCloseTo(24);
    expect(out.baseDamage.chaos).toBeCloseTo(0);
    expect(out.critChance).toBeCloseTo(0);
    expect(out.critMulti).toBeCloseTo(1);
    expect(out.chanceToIgnite).toBeCloseTo(0);
    expect(out.projectileSpeedPxPerSec).toBeGreaterThan(520);
    expect(out.rangePx).toBeGreaterThan(420);
    expect(out.projectiles).toBe(1);
  });

  test("baseline shotgun resolves 1.0x16x4 profile and uses authored multi spread", () => {
    const out = resolveWeaponStats(TOMMY_SHOTGUN_V1, { modifiers: [] });
    expect(out.shotsPerSecond).toBeCloseTo(1.0);
    expect(out.baseDamage.physical).toBeCloseTo(16);
    expect(out.projectiles).toBe(4);
    expect(out.rangePx).toBeLessThan(420);
    expect(out.multiProjectileSpreadDeg).toBeCloseTo(24);
  });

  test("baseline hobo syringe resolves chaos-only damage, no innate pierce, slow projectile, and base poison chance", () => {
    const out = resolveWeaponStats(HOBO_SYRINGE_V1, { modifiers: [] });
    expect(out.shotsPerSecond).toBeCloseTo(1.0);
    expect(out.baseDamage.physical).toBeCloseTo(0);
    expect(out.baseDamage.chaos).toBeCloseTo(18);
    expect(out.baseDamage.fire).toBeCloseTo(0);
    expect(out.pierce).toBe(0);
    expect(out.projectileSpeedPxPerSec).toBeCloseTo(180);
    expect(out.chanceToPoison).toBeCloseTo(0.5);
    expect(out.chanceToBleed).toBeCloseTo(0);
    expect(out.chanceToIgnite).toBeCloseTo(0);
  });

  test("baseline jamal throwing knife resolves to 1 projectile", () => {
    const out = resolveWeaponStats(JAMAL_THROWING_KNIFE_V1, { modifiers: [] });
    expect(out.shotsPerSecond).toBeCloseTo(1.0);
    expect(out.baseDamage.physical).toBeCloseTo(12);
    expect(out.projectiles).toBe(1);
    expect(out.rangePx).toBeCloseTo(380);
  });

  test("increased shotsPerSecond stacks additively", () => {
    const c1 = mkModifier("T1", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "increased", value: 0.15 }]);
    const c2 = mkModifier("T2", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "increased", value: 0.12 }]);

    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c1, c2] });
    expect(out.shotsPerSecond).toBeCloseTo(2.0 * (1 + 0.27));
  });

  test("engine supports more on the same key (even if starter modifiers don't use it)", () => {
    const c = mkModifier("T_MORE", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "more", value: 0.20 }]); // 20% more
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.shotsPerSecond).toBeCloseTo(2.0 * 1.2);
  });

  test("engine supports decreased and less on the same key", () => {
    const cDec = mkModifier("T_DEC", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "decreased", value: 0.10 }]);
    const cMore = mkModifier("T_MORE2", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "more", value: 0.20 }]);
    const cLess = mkModifier("T_LESS", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "less", value: 0.25 }]);

    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [cDec, cMore, cLess] });
    expect(out.shotsPerSecond).toBeCloseTo(2.0 * 0.9 * 1.2 * 0.75);
  });

  test("flat adds apply per damage type before conversion", () => {
    const c = mkModifier("T_FLAT", [
      { key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 3 },
      { key: STAT_KEYS.DAMAGE_ADD_FIRE, op: "add", value: 4 },
      { key: STAT_KEYS.DAMAGE_ADD_CHAOS, op: "add", value: 5 },
    ]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.baseDamage.physical).toBeCloseTo(12 + 3);
    expect(out.baseDamage.fire).toBeCloseTo(0 + 4);
    expect(out.baseDamage.chaos).toBeCloseTo(0 + 5);
  });

  test("conversion uses priority-fill pool consumption (phys->fire blocks phys->chaos when 100%)", () => {
    const c = mkModifier("T_CONV", [
      { key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 88 }, // make phys 100 total
      { key: STAT_KEYS.CONVERT_PHYS_TO_FIRE, op: "add", value: 1.0 },
      { key: STAT_KEYS.CONVERT_PHYS_TO_CHAOS, op: "add", value: 0.2 },
    ]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.baseDamage.physical).toBeCloseTo(0);
    expect(out.baseDamage.fire).toBeCloseTo(100);
    expect(out.baseDamage.chaos).toBeCloseTo(0);
  });

  test("generic damage increased scales all damage types equally", () => {
    const c = mkModifier("T_INC", [{ key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.25 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.baseDamage.physical).toBeCloseTo(12 * 1.25);
    expect(out.baseDamage.fire).toBeCloseTo(0);
    expect(out.baseDamage.chaos).toBeCloseTo(0);
  });

  test("critChance clamps to [0,1]", () => {
    const c = mkModifier("T_CRIT", [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 2.0 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.critChance).toBeCloseTo(1.0);
  });

  test("critMulti minimum is 1.0", () => {
    const c = mkModifier("T_CRM", [{ key: STAT_KEYS.CRIT_MULTI_ADD, op: "add", value: -10 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.critMulti).toBeCloseTo(1.0);
  });

  test("spreadBaseDeg clamps at 0", () => {
    const c = mkModifier("T_SPREAD", [{ key: STAT_KEYS.SPREAD_BASE_DEG_ADD, op: "add", value: -999 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.spreadBaseDeg).toBeCloseTo(0);
  });

  test("pierce is integer floor and clamps at 0", () => {
    const c1 = mkModifier("T_PIERCE_FRAC", [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: 1.9 }]);
    const out1 = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c1] });
    expect(out1.pierce).toBe(1);

    const c2 = mkModifier("T_PIERCE_NEG", [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: -999 }]);
    const out2 = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c2] });
    expect(out2.pierce).toBe(0);
  });

  test("projectiles is integer and clamps at minimum 1", () => {
    const c1 = mkModifier("T_PROJECTILES_PLUS", [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1.9 }]);
    const out1 = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c1] });
    expect(out1.projectiles).toBe(2);

    const c2 = mkModifier("T_PROJECTILES_NEG", [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: -999 }]);
    const out2 = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c2] });
    expect(out2.projectiles).toBe(1);
  });

  test("shotgun +1 projectile modifier resolves to 5 projectiles from base 4", () => {
    const c = mkModifier("T_SHOTGUN_PROJECTILE_PLUS", [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 }]);
    const out = resolveWeaponStats(TOMMY_SHOTGUN_V1, { modifiers: [c] });
    expect(out.projectiles).toBe(5);
  });

  test("ailment chances clamp to [0,1]", () => {
    const c = mkModifier("T_AIL", [
      { key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 2 },
      { key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: -1 },
      { key: STAT_KEYS.CHANCE_TO_BLEED_ADD, op: "add", value: 0.5 },
    ]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers: [c] });
    expect(out.chanceToIgnite).toBeCloseTo(1);
    expect(out.chanceToPoison).toBeCloseTo(0);
    expect(out.chanceToBleed).toBeCloseTo(0.5);
  });

  test("weapon base poison chance stacks additively with modifier poison chance", () => {
    const c = mkModifier("T_POISON", [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.25 }]);
    const out = resolveWeaponStats(HOBO_SYRINGE_V1, { modifiers: [c] });
    expect(out.chanceToPoison).toBeCloseTo(0.75);
  });

  test("weapon base poison chance still clamps to 1 with large added chance", () => {
    const c = mkModifier("T_POISON_OVER", [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 10 }]);
    const out = resolveWeaponStats(HOBO_SYRINGE_V1, { modifiers: [c] });
    expect(out.chanceToPoison).toBeCloseTo(1);
  });

  test("golden: combined mods produce expected resolved stats", () => {
    const modifiers: ModifierDef[] = [
      mkModifier("G1", [{ key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 2 }]), // phys 10
      mkModifier("G2", [{ key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.10 }]), // 10% increased
      mkModifier("G3", [{ key: STAT_KEYS.CONVERT_PHYS_TO_FIRE, op: "add", value: 0.5 }]), // 50% phys->fire
      mkModifier("G4", [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.05 }]), // crit 10%
      mkModifier("G5", [{ key: STAT_KEYS.SPREAD_BASE_DEG_ADD, op: "add", value: -1 }]), // spread 2.0
    ];

    const out = resolveWeaponStats(JACK_PISTOL_V1, { modifiers });

    // base phys = 12+2=14; convert 50% => phys 7 fire 7
    // apply 10% increased => phys 7.7 fire 7.7
    expect(out.baseDamage.physical).toBeCloseTo(7.7);
    expect(out.baseDamage.fire).toBeCloseTo(7.7);
    expect(out.baseDamage.chaos).toBeCloseTo(0);

    expect(out.critChance).toBeCloseTo(0.05 + 0.05);
    expect(out.spreadBaseDeg).toBeCloseTo(2.0);
  });
});

describe("resolveDotStats", () => {
  test("baseline DOT stats resolve to identity multipliers", () => {
    const out = resolveDotStats({ modifiers: [] });
    expect(out.poisonDamageMult).toBeCloseTo(1);
    expect(out.igniteDamageMult).toBeCloseTo(1);
    expect(out.dotDurationMult).toBeCloseTo(1);
    expect(out.tickRateMult).toBeCloseTo(1);
  });

  test("DOT scaling modifiers resolve as expected", () => {
    const modifiers: ModifierDef[] = [
      mkModifier("DOT_POISON", [{ key: STAT_KEYS.DOT_POISON_DAMAGE_INCREASED, op: "increased", value: 0.3 }]),
      mkModifier("DOT_IGNITE", [{ key: STAT_KEYS.DOT_IGNITE_DAMAGE_INCREASED, op: "increased", value: 0.3 }]),
      mkModifier("DOT_DUR", [{ key: STAT_KEYS.DOT_DURATION_INCREASED, op: "increased", value: 0.25 }]),
      mkModifier("DOT_TICK", [{ key: STAT_KEYS.DOT_TICK_RATE_MORE, op: "more", value: 0.2 }]),
    ];
    const out = resolveDotStats({ modifiers });
    expect(out.poisonDamageMult).toBeCloseTo(1.3);
    expect(out.igniteDamageMult).toBeCloseTo(1.3);
    expect(out.dotDurationMult).toBeCloseTo(1.25);
    expect(out.tickRateMult).toBeCloseTo(1.2);
  });
});
