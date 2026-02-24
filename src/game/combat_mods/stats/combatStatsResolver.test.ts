import { describe, expect, test } from "vitest";
import { resolveWeaponStats } from "./combatStatsResolver";
import { JACK_PISTOL_V1 } from "../content/weapons/jackPistol";
import { STAT_KEYS } from "./statKeys";
import type { CardDef, StatMod } from "./modifierTypes";

function mkCard(id: string, mods: StatMod[]): CardDef {
  return { id, isEnabled: true, displayName: id, rarity: 1, powerTier: 1, mods };
}

describe("resolveWeaponStats", () => {
  test("baseline pistol resolves stable defaults", () => {
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [] });

    expect(out.shotsPerSecond).toBeCloseTo(3.0);
    expect(out.baseDamage.physical).toBeCloseTo(8);
    expect(out.baseDamage.fire).toBeCloseTo(0);
    expect(out.baseDamage.chaos).toBeCloseTo(0);

    expect(out.critChance).toBeCloseTo(0.05);
    expect(out.critMulti).toBeCloseTo(1.5);

    expect(out.spreadBaseDeg).toBeCloseTo(3.0);
    expect(out.projectiles).toBe(1);
    expect(out.pierce).toBe(0);

    expect(out.chanceToBleed).toBeCloseTo(0);
    expect(out.chanceToIgnite).toBeCloseTo(0);
    expect(out.chanceToPoison).toBeCloseTo(0);

    expect(out.convert.physToFire).toBeCloseTo(0);
    expect(out.convert.physToChaos).toBeCloseTo(0);
    expect(out.convert.fireToChaos).toBeCloseTo(0);
  });

  test("increased shotsPerSecond stacks additively", () => {
    const c1 = mkCard("T1", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "increased", value: 0.15 }]);
    const c2 = mkCard("T2", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "increased", value: 0.12 }]);

    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c1, c2] });
    expect(out.shotsPerSecond).toBeCloseTo(3.0 * (1 + 0.27));
  });

  test("engine supports more on the same key (even if starter cards don't use it)", () => {
    const c = mkCard("T_MORE", [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "more", value: 0.20 }]); // 20% more
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.shotsPerSecond).toBeCloseTo(3.0 * 1.2);
  });

  test("flat adds apply per damage type before conversion", () => {
    const c = mkCard("T_FLAT", [
      { key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 3 },
      { key: STAT_KEYS.DAMAGE_ADD_FIRE, op: "add", value: 4 },
      { key: STAT_KEYS.DAMAGE_ADD_CHAOS, op: "add", value: 5 },
    ]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.baseDamage.physical).toBeCloseTo(8 + 3);
    expect(out.baseDamage.fire).toBeCloseTo(0 + 4);
    expect(out.baseDamage.chaos).toBeCloseTo(0 + 5);
  });

  test("conversion uses priority-fill pool consumption (phys->fire blocks phys->chaos when 100%)", () => {
    const c = mkCard("T_CONV", [
      { key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 92 }, // make phys 100 total
      { key: STAT_KEYS.CONVERT_PHYS_TO_FIRE, op: "add", value: 1.0 },
      { key: STAT_KEYS.CONVERT_PHYS_TO_CHAOS, op: "add", value: 0.2 },
    ]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.baseDamage.physical).toBeCloseTo(0);
    expect(out.baseDamage.fire).toBeCloseTo(100);
    expect(out.baseDamage.chaos).toBeCloseTo(0);
  });

  test("generic damage increased scales all damage types equally", () => {
    const c = mkCard("T_INC", [{ key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.25 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.baseDamage.physical).toBeCloseTo(8 * 1.25);
    expect(out.baseDamage.fire).toBeCloseTo(0);
    expect(out.baseDamage.chaos).toBeCloseTo(0);
  });

  test("critChance clamps to [0,1]", () => {
    const c = mkCard("T_CRIT", [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 2.0 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.critChance).toBeCloseTo(1.0);
  });

  test("critMulti minimum is 1.0", () => {
    const c = mkCard("T_CRM", [{ key: STAT_KEYS.CRIT_MULTI_ADD, op: "add", value: -10 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.critMulti).toBeCloseTo(1.0);
  });

  test("spreadBaseDeg clamps at 0", () => {
    const c = mkCard("T_SPREAD", [{ key: STAT_KEYS.SPREAD_BASE_DEG_ADD, op: "add", value: -999 }]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.spreadBaseDeg).toBeCloseTo(0);
  });

  test("pierce is integer floor and clamps at 0", () => {
    const c1 = mkCard("T_PIERCE_FRAC", [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: 1.9 }]);
    const out1 = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c1] });
    expect(out1.pierce).toBe(1);

    const c2 = mkCard("T_PIERCE_NEG", [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: -999 }]);
    const out2 = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c2] });
    expect(out2.pierce).toBe(0);
  });

  test("projectiles is integer and clamps at minimum 1", () => {
    const c1 = mkCard("T_PROJECTILES_PLUS", [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1.9 }]);
    const out1 = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c1] });
    expect(out1.projectiles).toBe(2);

    const c2 = mkCard("T_PROJECTILES_NEG", [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: -999 }]);
    const out2 = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c2] });
    expect(out2.projectiles).toBe(1);
  });

  test("ailment chances clamp to [0,1]", () => {
    const c = mkCard("T_AIL", [
      { key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 2 },
      { key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: -1 },
      { key: STAT_KEYS.CHANCE_TO_BLEED_ADD, op: "add", value: 0.5 },
    ]);
    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards: [c] });
    expect(out.chanceToIgnite).toBeCloseTo(1);
    expect(out.chanceToPoison).toBeCloseTo(0);
    expect(out.chanceToBleed).toBeCloseTo(0.5);
  });

  test("golden: combined mods produce expected resolved stats", () => {
    const cards: CardDef[] = [
      mkCard("G1", [{ key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 2 }]), // phys 10
      mkCard("G2", [{ key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.10 }]), // 10% increased
      mkCard("G3", [{ key: STAT_KEYS.CONVERT_PHYS_TO_FIRE, op: "add", value: 0.5 }]), // 50% phys->fire
      mkCard("G4", [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.05 }]), // crit 10%
      mkCard("G5", [{ key: STAT_KEYS.SPREAD_BASE_DEG_ADD, op: "add", value: -1 }]), // spread 2.0
    ];

    const out = resolveWeaponStats(JACK_PISTOL_V1, { cards });

    // base phys = 8+2=10; convert 50% => phys 5 fire 5
    // apply 10% increased => phys 5.5 fire 5.5
    expect(out.baseDamage.physical).toBeCloseTo(5.5);
    expect(out.baseDamage.fire).toBeCloseTo(5.5);
    expect(out.baseDamage.chaos).toBeCloseTo(0);

    expect(out.critChance).toBeCloseTo(0.05 + 0.05);
    expect(out.spreadBaseDeg).toBeCloseTo(2.0);
  });
});
