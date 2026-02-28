import { describe, expect, test } from "vitest";
import { AILMENT_STACK_CAP } from "./ailmentTypes";
import { applyAilmentsFromHit } from "./applyAilmentsFromHit";
import { createEnemyAilmentsState } from "./enemyAilments";

describe("applyAilmentsFromHit", () => {
  test("0 fire means no ignite even with chance=1", () => {
    const st = createEnemyAilmentsState();
    applyAilmentsFromHit(
      st,
      { physical: 0, fire: 0, chaos: 0 },
      { bleed: 0, ignite: 1, poison: 0 },
      { bleed: 0, ignite: 0, poison: 0 }
    );
    expect(st.ignite).toBeNull();
  });

  test("0 chaos means no poison even with chance=1", () => {
    const st = createEnemyAilmentsState();
    applyAilmentsFromHit(
      st,
      { physical: 0, fire: 0, chaos: 0 },
      { bleed: 0, ignite: 0, poison: 1 },
      { bleed: 0, ignite: 0, poison: 0 }
    );
    expect(st.poison.length).toBe(0);
  });

  test("PASS_DAMAGE_TO_POISON_ALL mode lets non-chaos hit damage feed poison", () => {
    const st = createEnemyAilmentsState();
    applyAilmentsFromHit(
      st,
      { physical: 10, fire: 10, chaos: 0 },
      { bleed: 0, ignite: 0, poison: 1 },
      { bleed: 0, ignite: 0, poison: 0 },
      { allDamageContributesToPoison: true }
    );
    expect(st.poison.length).toBe(1);
    expect(st.poison[0]?.dps ?? 0).toBeGreaterThan(0);
  });

  test("PASS_DAMAGE_TO_POISON_ALL still requires poison chance to apply poison", () => {
    const st = createEnemyAilmentsState();
    applyAilmentsFromHit(
      st,
      { physical: 10, fire: 10, chaos: 10 },
      { bleed: 0, ignite: 0, poison: 0 },
      { bleed: 0, ignite: 0, poison: 0 },
      { allDamageContributesToPoison: true }
    );
    expect(st.poison.length).toBe(0);
  });

  test("chance=1 applies and chance=0 does not apply", () => {
    const st = createEnemyAilmentsState();

    applyAilmentsFromHit(
      st,
      { physical: 10, fire: 10, chaos: 10 },
      { bleed: 1, ignite: 1, poison: 1 },
      { bleed: 0.5, ignite: 0.5, poison: 0.5 }
    );

    expect(st.bleed.length).toBe(1);
    expect(st.poison.length).toBe(1);
    expect(st.ignite).not.toBeNull();

    applyAilmentsFromHit(
      st,
      { physical: 10, fire: 10, chaos: 10 },
      { bleed: 0, ignite: 0, poison: 0 },
      { bleed: 0, ignite: 0, poison: 0 }
    );

    expect(st.bleed.length).toBe(1);
    expect(st.poison.length).toBe(1);
    expect(st.ignite).not.toBeNull();
  });

  test("stacking increments until cap", () => {
    const st = createEnemyAilmentsState();

    for (let i = 0; i < AILMENT_STACK_CAP + 10; i++) {
      applyAilmentsFromHit(
        st,
        { physical: 10, fire: 0, chaos: 10 },
        { bleed: 1, ignite: 0, poison: 1 },
        { bleed: 0, ignite: 1, poison: 0 }
      );
    }

    expect(st.bleed.length).toBe(AILMENT_STACK_CAP);
    expect(st.poison.length).toBe(AILMENT_STACK_CAP);
  });

  test("ignite replaces only when stronger", () => {
    const st = createEnemyAilmentsState();

    applyAilmentsFromHit(
      st,
      { physical: 0, fire: 8, chaos: 0 },
      { bleed: 0, ignite: 1, poison: 0 },
      { bleed: 1, ignite: 0, poison: 1 }
    );
    const dps1 = st.ignite?.dps ?? 0;

    applyAilmentsFromHit(
      st,
      { physical: 0, fire: 4, chaos: 0 },
      { bleed: 0, ignite: 1, poison: 0 },
      { bleed: 1, ignite: 0, poison: 1 }
    );
    expect(st.ignite?.dps).toBeCloseTo(dps1);

    applyAilmentsFromHit(
      st,
      { physical: 0, fire: 20, chaos: 0 },
      { bleed: 0, ignite: 1, poison: 0 },
      { bleed: 1, ignite: 0, poison: 1 }
    );
    expect((st.ignite?.dps ?? 0)).toBeGreaterThan(dps1);
  });

  test("damage-to-poison conversion adds poison without chaos damage", () => {
    const st = createEnemyAilmentsState();
    applyAilmentsFromHit(
      st,
      { physical: 10, fire: 0, chaos: 0 },
      { bleed: 0, ignite: 0, poison: 0 },
      { bleed: 1, ignite: 1, poison: 1 },
      { poisonFromDamage: 6 }
    );
    expect(st.poison.length).toBe(1);
    expect(st.poison[0]?.dps ?? 0).toBeGreaterThan(0);
  });

  test("dot specialist math: -50% hit base then 200% more dot => 150% final dot", () => {
    const base = createEnemyAilmentsState();
    applyAilmentsFromHit(
      base,
      { physical: 0, fire: 100, chaos: 0 },
      { bleed: 0, ignite: 1, poison: 0 },
      { bleed: 0, ignite: 0, poison: 0 },
    );
    const baseIgniteDps = base.ignite?.dps ?? 0;
    expect(baseIgniteDps).toBeGreaterThan(0);

    const specialist = createEnemyAilmentsState();
    applyAilmentsFromHit(
      specialist,
      { physical: 0, fire: 50, chaos: 0 },
      { bleed: 0, ignite: 1, poison: 0 },
      { bleed: 0, ignite: 0, poison: 0 },
      { igniteDamageMult: 3.0 },
    );

    const specialistIgniteDps = specialist.ignite?.dps ?? 0;
    expect(specialistIgniteDps).toBeCloseTo(baseIgniteDps * 1.5, 6);
  });

  test("dot duration multiplier increases poison and ignite duration", () => {
    const st = createEnemyAilmentsState();
    applyAilmentsFromHit(
      st,
      { physical: 0, fire: 10, chaos: 10 },
      { bleed: 0, ignite: 1, poison: 1 },
      { bleed: 0, ignite: 0, poison: 0 },
      { poisonDurationMult: 1.25, igniteDurationMult: 1.25 },
    );
    expect(st.poison[0]?.tLeft ?? 0).toBeCloseTo(2.5, 6);
    expect(st.ignite?.tLeft ?? 0).toBeCloseTo(5, 6);
  });
});
