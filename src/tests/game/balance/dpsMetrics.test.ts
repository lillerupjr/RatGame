import { describe, expect, test } from "vitest";
import { createDpsMetrics, recordDamage, tickDpsMetrics } from "../../../game/balance/dpsMetrics";

describe("dpsMetrics", () => {
  test("recordDamage appends valid events only", () => {
    const m = createDpsMetrics(5, 2);
    recordDamage(m, 1, 10);
    recordDamage(m, 1.5, -1);
    recordDamage(m, 2, Number.NaN);
    expect(m.events.length).toBe(1);
    expect(m.events[0]).toEqual({ t: 1, amount: 10 });
  });

  test("tick prunes old events and computes instant DPS", () => {
    const m = createDpsMetrics(5, 1);
    recordDamage(m, 0, 10);
    recordDamage(m, 2, 20);
    recordDamage(m, 6, 30);
    tickDpsMetrics(m, 6, 0.1);
    expect(m.events.length).toBe(2);
    expect(m.dpsInstant).toBeCloseTo((20 + 30) / 5);
  });

  test("smoothed DPS converges toward instant DPS", () => {
    const m = createDpsMetrics(5, 1);
    for (let t = 0; t <= 5; t += 0.5) {
      recordDamage(m, t, 5);
    }
    for (let i = 0; i < 20; i++) {
      tickDpsMetrics(m, 3 + i * 0.1, 0.1);
    }
    expect(m.dpsInstant).toBeCloseTo(11);
    expect(m.dpsSmoothed).toBeGreaterThan(9);
    expect(m.dpsSmoothed).toBeLessThanOrEqual(11);
  });
});
