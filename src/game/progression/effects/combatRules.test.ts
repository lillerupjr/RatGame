import { describe, expect, test } from "vitest";
import {
  applyNonPhysicalHitDamageSuppression,
  applyPhysicalHitDamageIncreased,
  applyProjectilePiercedEnemyDamageIncreased,
  buildCombatRulesSnapshot,
  scaleCombatRule,
} from "./combatRules";

describe("combat rule snapshots", () => {
  test("scales and snapshots no-pierce nearby hit damage rules", () => {
    const rule = scaleCombatRule(
      { kind: "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED", rangePx: 100, increased: 0.2 },
      0.5,
    );

    expect(rule).toMatchObject({
      kind: "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED",
      rangePx: 150,
    });
    expect((rule as any).increased).toBeCloseTo(0.3);

    const snapshot = buildCombatRulesSnapshot([
      rule,
      { kind: "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED", rangePx: 220, increased: 0.1 },
    ]);

    expect(snapshot.noPierceNearbyHitDamageIncreased?.rangePx).toBe(220);
    expect(snapshot.noPierceNearbyHitDamageIncreased?.increased).toBeCloseTo(0.4);
  });

  test("snapshots physical scaling and non-physical suppression", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "PHYSICAL_HIT_DAMAGE_INCREASED_NON_PHYSICAL_SUPPRESSED", increased: 0.3 },
    ]);

    expect(snapshot.physicalHitDamageIncreased).toBeCloseTo(0.3);
    expect(snapshot.suppressNonPhysicalHitDamage).toBe(true);

    const scaled = applyPhysicalHitDamageIncreased({ physical: 10, fire: 5, chaos: 7 }, snapshot);
    expect(scaled).toEqual({ physical: 13, fire: 5, chaos: 7 });
    expect(applyNonPhysicalHitDamageSuppression(scaled, snapshot)).toEqual({
      physical: 13,
      fire: 0,
      chaos: 0,
    });
  });

  test("counts equipped family rings for physical devotion scaling", () => {
    const snapshot = buildCombatRulesSnapshot(
      [
        {
          kind: "PHYSICAL_HIT_DAMAGE_INCREASED_PER_EQUIPPED_FAMILY_RING",
          familyId: "physical",
          increasedPerRing: 0.2,
        },
      ],
      { equippedRingFamilyCounts: { physical: 2 } },
    );

    expect(snapshot.physicalHitDamageIncreased).toBeCloseTo(0.4);
    expect(snapshot.suppressNonPhysicalHitDamage).toBe(false);
  });

  test("snapshots burning enemies move speed reduced (accumulates)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "BURNING_ENEMIES_MOVE_SPEED_REDUCED", reduced: 0.1 },
      { kind: "BURNING_ENEMIES_MOVE_SPEED_REDUCED", reduced: 0.05 },
    ]);
    expect(snapshot.burningEnemiesMoveSpeedReduced).toBeCloseTo(0.15);
  });

  test("snapshots poisoned enemies damage reduced (accumulates)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "POISONED_ENEMIES_DAMAGE_REDUCED", reduced: 0.2 },
      { kind: "POISONED_ENEMIES_DAMAGE_REDUCED", reduced: 0.1 },
    ]);
    expect(snapshot.poisonedEnemiesDamageReduced).toBeCloseTo(0.3);
  });

  test("snapshots poisoned enemies explode on death (picks highest scalar)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "POISONED_ENEMIES_EXPLODE_ON_DEATH", radius: 80, damageScalar: 0.3, damageType: "CHAOS" },
      { kind: "POISONED_ENEMIES_EXPLODE_ON_DEATH", radius: 100, damageScalar: 0.5, damageType: "CHAOS" },
    ]);
    expect(snapshot.poisonedEnemiesExplodeOnDeath).toEqual({
      radius: 100,
      damageScalar: 0.5,
      damageType: "CHAOS",
    });
  });

  test("snapshots poison trail (first wins, max radius/dps)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "POISON_TRAIL", radius: 30, poisonDps: 5, tickEvery: 0.5, trailTtl: 3, dropEvery: 0.3 },
    ]);
    expect(snapshot.poisonTrail).toEqual({
      radius: 30,
      poisonDps: 5,
      tickEvery: 0.5,
      trailTtl: 3,
      dropEvery: 0.3,
    });
  });

  test("snapshots laser executor (first wins, max threshold/range)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "LASER_EXECUTOR", thresholdFraction: 0.15, rangePx: 200, scanEvery: 1.5 },
    ]);
    expect(snapshot.laserExecutor).toEqual({
      thresholdFraction: 0.15,
      rangePx: 200,
      scanEvery: 1.5,
    });
  });

  test("scales burning enemies move speed reduced", () => {
    const rule = scaleCombatRule(
      { kind: "BURNING_ENEMIES_MOVE_SPEED_REDUCED", reduced: 0.1 },
      0.5,
    );
    expect((rule as any).reduced).toBeCloseTo(0.15);
  });

  test("scales poisoned enemies damage reduced", () => {
    const rule = scaleCombatRule(
      { kind: "POISONED_ENEMIES_DAMAGE_REDUCED", reduced: 0.2 },
      0.5,
    );
    expect((rule as any).reduced).toBeCloseTo(0.3);
  });

  test("scales poisoned enemies explode on death", () => {
    const rule = scaleCombatRule(
      { kind: "POISONED_ENEMIES_EXPLODE_ON_DEATH", radius: 100, damageScalar: 0.5, damageType: "CHAOS" },
      0.5,
    );
    expect((rule as any).damageScalar).toBeCloseTo(0.75);
    expect((rule as any).radius).toBeCloseTo(150);
  });

  test("snapshots physical hit stun chance (picks highest chance and stun duration)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "PHYSICAL_HIT_STUN_CHANCE", chance: 0.05, stunDurationSec: 0.5 },
      { kind: "PHYSICAL_HIT_STUN_CHANCE", chance: 0.1, stunDurationSec: 0.3 },
    ]);
    expect(snapshot.physicalHitStunChance?.chance).toBeCloseTo(0.1);
    expect(snapshot.physicalHitStunChance?.stunDurationSec).toBeCloseTo(0.5);
  });

  test("scales physical hit stun chance", () => {
    const rule = scaleCombatRule(
      { kind: "PHYSICAL_HIT_STUN_CHANCE", chance: 0.05, stunDurationSec: 0.5 },
      0.5,
    );
    expect((rule as any).chance).toBeCloseTo(0.075);
    expect((rule as any).stunDurationSec).toBeCloseTo(0.75);
  });

  test("snapshots timed next shot empower (picks fastest charge, highest increased)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "TIMED_NEXT_SHOT_EMPOWER", chargeEvery: 4, physicalDamageIncreased: 0.5 },
      { kind: "TIMED_NEXT_SHOT_EMPOWER", chargeEvery: 3, physicalDamageIncreased: 0.4 },
    ]);
    expect(snapshot.timedNextShotEmpower?.chargeEvery).toBeCloseTo(3);
    expect(snapshot.timedNextShotEmpower?.physicalDamageIncreased).toBeCloseTo(0.5);
  });

  test("scales timed next shot empower", () => {
    const rule = scaleCombatRule(
      { kind: "TIMED_NEXT_SHOT_EMPOWER", chargeEvery: 4, physicalDamageIncreased: 0.5 },
      0.5,
    );
    expect((rule as any).physicalDamageIncreased).toBeCloseTo(0.75);
    expect((rule as any).chargeEvery).toBe(4);
  });

  test("snapshots kill empower next shot (accumulates)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "KILL_EMPOWER_NEXT_SHOT", damageIncreased: 0.2 },
      { kind: "KILL_EMPOWER_NEXT_SHOT", damageIncreased: 0.1 },
    ]);
    expect(snapshot.killEmpowerNextShot?.damageIncreased).toBeCloseTo(0.3);
  });

  test("scales kill empower next shot", () => {
    const rule = scaleCombatRule(
      { kind: "KILL_EMPOWER_NEXT_SHOT", damageIncreased: 0.2 },
      0.5,
    );
    expect((rule as any).damageIncreased).toBeCloseTo(0.3);
  });

  test("snapshots crit move speed buff (picks highest)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "CRIT_MOVE_SPEED_BUFF", moveSpeedIncreased: 0.2, durationSec: 1 },
      { kind: "CRIT_MOVE_SPEED_BUFF", moveSpeedIncreased: 0.3, durationSec: 0.5 },
    ]);
    expect(snapshot.critMoveSpeedBuff?.moveSpeedIncreased).toBeCloseTo(0.3);
    expect(snapshot.critMoveSpeedBuff?.durationSec).toBeCloseTo(1);
  });

  test("scales crit move speed buff", () => {
    const rule = scaleCombatRule(
      { kind: "CRIT_MOVE_SPEED_BUFF", moveSpeedIncreased: 0.2, durationSec: 1 },
      0.5,
    );
    expect((rule as any).moveSpeedIncreased).toBeCloseTo(0.3);
    expect((rule as any).durationSec).toBeCloseTo(1.5);
  });

  test("snapshots living bomb (picks highest scalar and radius)", () => {
    const snapshot = buildCombatRulesSnapshot([
      { kind: "LIVING_BOMB", markEvery: 20, speedIncreased: 0.5, explosionDamageScalar: 3.0, explosionRadius: 150 },
    ]);
    expect(snapshot.livingBomb).toEqual({
      markEvery: 20,
      speedIncreased: 0.5,
      explosionDamageScalar: 3.0,
      explosionRadius: 150,
    });

    const snapshot2 = buildCombatRulesSnapshot([
      { kind: "LIVING_BOMB", markEvery: 20, speedIncreased: 0.5, explosionDamageScalar: 2.0, explosionRadius: 100 },
      { kind: "LIVING_BOMB", markEvery: 15, speedIncreased: 0.3, explosionDamageScalar: 3.0, explosionRadius: 150 },
    ]);
    expect(snapshot2.livingBomb?.explosionDamageScalar).toBeCloseTo(3.0);
    expect(snapshot2.livingBomb?.explosionRadius).toBeCloseTo(150);
  });

  test("scales living bomb", () => {
    const rule = scaleCombatRule(
      { kind: "LIVING_BOMB", markEvery: 20, speedIncreased: 0.5, explosionDamageScalar: 3.0, explosionRadius: 150 },
      0.5,
    );
    expect((rule as any).explosionDamageScalar).toBeCloseTo(4.5);
    expect((rule as any).explosionRadius).toBeCloseTo(225);
    // markEvery and speedIncreased are not scaled
    expect((rule as any).markEvery).toBe(20);
    expect((rule as any).speedIncreased).toBe(0.5);
  });

  test("scales projectile hit damage per pierced enemy", () => {
    const scaledRule = scaleCombatRule(
      { kind: "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY", increasedPerEnemy: 0.3 },
      0.5,
    );
    expect(scaledRule).toMatchObject({
      kind: "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY",
    });
    expect((scaledRule as any).increasedPerEnemy).toBeCloseTo(0.45);

    const snapshot = buildCombatRulesSnapshot([
      scaledRule,
      { kind: "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY", increasedPerEnemy: 0.05 },
    ]);

    expect(snapshot.projectileHitDamageIncreasedPerPiercedEnemy).toBeCloseTo(0.5);
    expect(
      applyProjectilePiercedEnemyDamageIncreased(
        { physical: 10, fire: 4, chaos: 2 },
        snapshot,
        2,
      ),
    ).toEqual({ physical: 20, fire: 8, chaos: 4 });
  });
});
