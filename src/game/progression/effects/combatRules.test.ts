import { describe, expect, test } from "vitest";
import {
  applyNonPhysicalHitDamageSuppression,
  applyPhysicalHitDamageIncreased,
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
});
