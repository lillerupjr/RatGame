import { describe, expect, test } from "vitest";
import {
  addBleed,
  addPoison,
  applyIgniteStrongestOnly,
  createEnemyAilmentsState,
  tickEnemyAilments,
} from "./enemyAilments";
import { AILMENT_DURATIONS, AILMENT_STACK_CAP } from "./ailmentTypes";

describe("enemyAilments", () => {
  test("stack caps for poison and bleed are enforced", () => {
    const st = createEnemyAilmentsState();

    for (let i = 0; i < AILMENT_STACK_CAP + 5; i++) {
      addPoison(st, 10);
      addBleed(st, 10);
    }

    expect(st.poison.length).toBe(AILMENT_STACK_CAP);
    expect(st.bleed.length).toBe(AILMENT_STACK_CAP);
  });

  test("durations are assigned from locked constants", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 20);
    addBleed(st, 24);
    applyIgniteStrongestOnly(st, 16);

    expect(st.poison[0]?.tLeft).toBeCloseTo(AILMENT_DURATIONS.poison);
    expect(st.bleed[0]?.tLeft).toBeCloseTo(AILMENT_DURATIONS.bleed);
    expect(st.ignite?.tLeft).toBeCloseTo(AILMENT_DURATIONS.ignite);
  });

  test("ignite strongest-only replacement", () => {
    const st = createEnemyAilmentsState();

    applyIgniteStrongestOnly(st, 8); // dps = 2 over 4s
    const first = st.ignite;
    expect(first).not.toBeNull();

    applyIgniteStrongestOnly(st, 4); // weaker, should not replace
    expect(st.ignite?.dps).toBeCloseTo(first?.dps ?? 0);

    applyIgniteStrongestOnly(st, 20); // stronger, should replace
    expect(st.ignite?.dps).toBeCloseTo(20 / AILMENT_DURATIONS.ignite);
  });

  test("tick removes expired stacks and ignite", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 10);
    addBleed(st, 10);
    applyIgniteStrongestOnly(st, 10);

    tickEnemyAilments(st, 10);

    expect(st.poison.length).toBe(0);
    expect(st.bleed.length).toBe(0);
    expect(st.ignite).toBeNull();
  });
});
