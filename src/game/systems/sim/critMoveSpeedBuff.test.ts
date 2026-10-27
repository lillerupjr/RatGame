import { describe, expect, test } from "vitest";
import { buildCombatRulesSnapshot } from "../../progression/effects/combatRules";
import { tickCritMoveSpeedBuff } from "./critMoveSpeedBuff";
import { makeWeaponHitMeta } from "../../combat/damageMeta";

function stubWorld(): any {
  return {
    events: [],
  };
}

describe("critMoveSpeedBuff", () => {
  test("activates buff on crit event", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([
      { kind: "CRIT_MOVE_SPEED_BUFF", moveSpeedIncreased: 0.2, durationSec: 1 },
    ]);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 10,
      x: 0,
      y: 0,
      isCrit: true,
      damageMeta: makeWeaponHitMeta("test-weapon", { category: "HIT", instigatorId: "player", isProcDamage: false }),
    });
    tickCritMoveSpeedBuff(world, 0.016, combatRules);

    const state = (world as any)._critMoveSpeedBuff;
    expect(state.tLeft).toBeGreaterThan(0);
    expect(state.increased).toBeCloseTo(0.2);
  });

  test("buff expires after duration", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([
      { kind: "CRIT_MOVE_SPEED_BUFF", moveSpeedIncreased: 0.2, durationSec: 1 },
    ]);

    world.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 10,
      x: 0,
      y: 0,
      isCrit: true,
      damageMeta: makeWeaponHitMeta("test-weapon", { category: "HIT", instigatorId: "player", isProcDamage: false }),
    });
    tickCritMoveSpeedBuff(world, 0.016, combatRules);

    // Clear events and tick past duration
    world.events = [];
    tickCritMoveSpeedBuff(world, 1.1, combatRules);

    const state = (world as any)._critMoveSpeedBuff;
    expect(state.tLeft).toBe(0);
  });

  test("does nothing without combat rule", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([]);

    tickCritMoveSpeedBuff(world, 10, combatRules);
    expect((world as any)._critMoveSpeedBuff).toBeUndefined();
  });
});
