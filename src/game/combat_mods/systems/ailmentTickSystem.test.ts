import { describe, expect, test } from "vitest";
import { createEnemyAilmentsState, addPoison, addBleed, applyIgniteStacked } from "../ailments/enemyAilments";
import { ailmentTickSystem } from "./ailmentTickSystem";

describe("ailmentTickSystem", () => {
  test("applies per-frame DoT damage with no mitigation", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 20); // dps 10
    addPoison(st, 10); // dps 5
    addBleed(st, 12); // dps 2
    applyIgniteStacked(st, 16); // dps 4

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
    applyIgniteStacked(st, 16);

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      events: [],
    };

    ailmentTickSystem(w, 7.0);

    expect(w.eAilments[0].poison.length).toBe(0);
    expect(w.eAilments[0].bleed.length).toBe(0);
    expect(w.eAilments[0].ignite.length).toBe(0);
  });

  test("poison/ignite only apply on 0.1s discrete ticks", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 20); // dps 10
    applyIgniteStacked(st, 16); // dps 4

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      events: [],
    };

    ailmentTickSystem(w, 0.099);
    // no poison/ignite tick yet
    expect(w.eHp[0]).toBeCloseTo(100);

    ailmentTickSystem(w, 0.005);
    // one 0.1s tick: (10 + 4) * 0.1 = 1.4
    expect(w.eHp[0]).toBeCloseTo(98.6);
  });

  test("bleed also applies on 0.1s discrete ticks", () => {
    const st = createEnemyAilmentsState();
    addBleed(st, 12); // dps 2

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      events: [],
    };

    ailmentTickSystem(w, 0.099);
    expect(w.eHp[0]).toBeCloseTo(100);

    ailmentTickSystem(w, 0.005);
    // one 0.1s tick: 2 * 0.1 = 0.2
    expect(w.eHp[0]).toBeCloseTo(99.8);
  });

  test("CARD_DOT_TICK_RATE_MORE_20 scales DoT output inside the fixed tick pipeline", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 10); // dps 5 over 2s

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      cards: ["CARD_DOT_TICK_RATE_MORE_20"],
      events: [],
    };

    ailmentTickSystem(w, 0.099);
    expect(w.eHp[0]).toBeCloseTo(100);

    ailmentTickSystem(w, 0.005);
    // one fixed 0.1s tick: 5 * 0.1 * 1.2 = 0.6
    expect(w.eHp[0]).toBeCloseTo(99.4);
  });

  test("SPEC_DOT_SPECIALIST multiplies dot damage by 3x in tick pipeline", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 10); // dps 5 -> base first tick damage 2.5

    const w: any = {
      eAlive: [true],
      eHp: [100],
      eAilments: [st],
      relics: ["SPEC_DOT_SPECIALIST"],
      events: [],
    };

    ailmentTickSystem(w, 0.5);
    expect(w.eHp[0]).toBeCloseTo(92.5);
  });

  test("dot kill emits ailment-attributed ENEMY_KILLED metadata", () => {
    const st = createEnemyAilmentsState();
    addPoison(st, 20); // dps 10 => 5 damage on first 0.5s tick

    const w: any = {
      eAlive: [true],
      eHp: [4],
      eAilments: [st],
      eSpawnTriggerId: ["zone_test"],
      ePoisonedOnDeath: [],
      kills: 0,
      events: [],
      time: 0,
      timeSec: 0,
    };

    ailmentTickSystem(w, 0.5);

    const killEv = w.events.find((ev: any) => ev.type === "ENEMY_KILLED");
    expect(killEv).toBeTruthy();
    expect(killEv.damageMeta.cause.kind).toBe("AILMENT");
    expect(killEv.damageMeta.cause.ailment).toBe("POISON");
    expect(killEv.damageMeta.isProcDamage === true).toBe(false);
  });
});
