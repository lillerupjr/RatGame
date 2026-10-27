import { describe, expect, test } from "vitest";
import { buildCombatRulesSnapshot } from "../../progression/effects/combatRules";
import { tickNextShotEmpower, consumeNextShotEmpower } from "./empowerSystem";
import { makeWeaponHitMeta } from "../../combat/damageMeta";

function stubWorld(): any {
  return {
    events: [],
  };
}

describe("empowerSystem", () => {
  test("timed empower charges after interval and empowers physical damage", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([
      { kind: "TIMED_NEXT_SHOT_EMPOWER", chargeEvery: 4, physicalDamageIncreased: 0.5 },
    ]);

    // Tick 3 seconds — not enough to charge
    tickNextShotEmpower(world, 3, combatRules);
    let empower = consumeNextShotEmpower(world);
    expect(empower.physIncreased).toBe(0);

    // Tick 1 more second — should charge
    tickNextShotEmpower(world, 1, combatRules);
    empower = consumeNextShotEmpower(world);
    expect(empower.physIncreased).toBeCloseTo(0.5);
  });

  test("timed empower is consumed after one shot", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([
      { kind: "TIMED_NEXT_SHOT_EMPOWER", chargeEvery: 4, physicalDamageIncreased: 0.5 },
    ]);

    tickNextShotEmpower(world, 4, combatRules);
    consumeNextShotEmpower(world);
    const empower = consumeNextShotEmpower(world);
    expect(empower.physIncreased).toBe(0);
  });

  test("kill empower activates from ENEMY_KILLED event", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([
      { kind: "KILL_EMPOWER_NEXT_SHOT", damageIncreased: 0.2 },
    ]);

    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 0,
      damage: 10,
      x: 0,
      y: 0,
      isCrit: false,
      damageMeta: makeWeaponHitMeta("test-weapon", { category: "HIT", instigatorId: "player", isProcDamage: false }),
    });
    tickNextShotEmpower(world, 0.016, combatRules);

    const empower = consumeNextShotEmpower(world);
    expect(empower.allIncreased).toBeCloseTo(0.2);
  });

  test("does nothing when no combat rules present", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([]);

    tickNextShotEmpower(world, 10, combatRules);
    const empower = consumeNextShotEmpower(world);
    expect(empower.physIncreased).toBe(0);
    expect(empower.allIncreased).toBe(0);
  });
});
