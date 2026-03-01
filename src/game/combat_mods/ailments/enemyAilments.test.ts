import { describe, expect, test } from "vitest";
import {
  addIgniteFromSnapshot,
  addBleed,
  addPoison,
  applyIgniteStacked,
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
    applyIgniteStacked(st, 16);

    expect(st.poison[0]?.tLeft).toBeCloseTo(AILMENT_DURATIONS.poison);
    expect(st.bleed[0]?.tLeft).toBeCloseTo(AILMENT_DURATIONS.bleed);
    expect(st.ignite[0]?.tLeft).toBeCloseTo(AILMENT_DURATIONS.ignite);
  });

  test("ignite stacks accumulate until cap", () => {
    const st = createEnemyAilmentsState();
    for (let i = 0; i < AILMENT_STACK_CAP + 5; i++) {
      applyIgniteStacked(st, 8);
    }
    expect(st.ignite.length).toBe(AILMENT_STACK_CAP);
  });

  test("ignite cap replacement ignores weaker stack and replaces weakest with stronger", () => {
    const st = createEnemyAilmentsState();
    for (let i = 0; i < AILMENT_STACK_CAP; i++) {
      addIgniteFromSnapshot(st, { kind: "ignite", dps: i + 1, tLeft: AILMENT_DURATIONS.ignite });
    }
    const minBefore = Math.min(...st.ignite.map((s) => s.dps));
    expect(minBefore).toBe(1);

    applyIgniteStacked(st, 2); // 0.5 dps over 4s; weaker than weakest=1 => no replace
    expect(st.ignite.length).toBe(AILMENT_STACK_CAP);
    expect(Math.min(...st.ignite.map((s) => s.dps))).toBeCloseTo(1);

    applyIgniteStacked(st, 200); // 50 dps over 4s; should replace weakest
    expect(st.ignite.length).toBe(AILMENT_STACK_CAP);
    expect(Math.min(...st.ignite.map((s) => s.dps))).toBeGreaterThan(1);
    expect(Math.max(...st.ignite.map((s) => s.dps))).toBeCloseTo(50);
  });

  test("tick removes expired stacks and ignite", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 10);
    addBleed(st, 10);
    applyIgniteStacked(st, 10);
    applyIgniteStacked(st, 5);

    tickEnemyAilments(st, 10);

    expect(st.poison.length).toBe(0);
    expect(st.bleed.length).toBe(0);
    expect(st.ignite.length).toBe(0);
  });
});
