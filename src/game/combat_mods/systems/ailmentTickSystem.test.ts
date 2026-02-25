import { describe, expect, test } from "vitest";
import { createEnemyAilmentsState, addPoison, addBleed, applyIgniteStrongestOnly } from "../ailments/enemyAilments";
import { ailmentTickSystem } from "./ailmentTickSystem";

describe("ailmentTickSystem", () => {
  test("applies per-frame DoT damage with no mitigation", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 20); // dps 10
    addPoison(st, 10); // dps 5
    addBleed(st, 12); // dps 2
    applyIgniteStrongestOnly(st, 16); // dps 4

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      events: [],
    };

    ailmentTickSystem(w, 1.0);

    // total dps = 10 + 5 + 2 + 4 = 21
    expect(w.eHp[0]).toBeCloseTo(79);
  });

  test("expires stacks and ignite after enough time", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 20);
    addBleed(st, 12);
    applyIgniteStrongestOnly(st, 16);

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      events: [],
    };

    ailmentTickSystem(w, 7.0);

    expect(w.eAilments[0].poison.length).toBe(0);
    expect(w.eAilments[0].bleed.length).toBe(0);
    expect(w.eAilments[0].ignite).toBeNull();
  });

  test("poison/ignite only apply on 0.5s discrete ticks", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 20); // dps 10
    applyIgniteStrongestOnly(st, 16); // dps 4

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      events: [],
    };

    ailmentTickSystem(w, 0.25);
    // no poison/ignite tick yet
    expect(w.eHp[0]).toBeCloseTo(100);

    ailmentTickSystem(w, 0.25);
    // one 0.5s tick: (10 + 4) * 0.5 = 7
    expect(w.eHp[0]).toBeCloseTo(93);
  });

  test("bleed also applies on 0.5s discrete ticks", () => {
    const st = createEnemyAilmentsState();
    addBleed(st, 12); // dps 2

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      events: [],
    };

    ailmentTickSystem(w, 0.25);
    expect(w.eHp[0]).toBeCloseTo(100);

    ailmentTickSystem(w, 0.25);
    // one 0.5s tick: 2 * 0.5 = 1
    expect(w.eHp[0]).toBeCloseTo(99);
  });
});
