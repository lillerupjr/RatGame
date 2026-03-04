import { describe, expect, test } from "vitest";
import { BASELINE_PLAYER_DPS, computePressure } from "../../../game/balance/pressureModel";

describe("pressureModel", () => {
  test("matches authoritative curve checkpoints", () => {
    expect(computePressure(0)).toBeCloseTo(0.8);
    expect(computePressure(120)).toBeCloseTo(1.6);
    expect(computePressure(180)).toBeCloseTo(3.2);
  });

  test("baseline spawn HP/sec checkpoints", () => {
    expect(BASELINE_PLAYER_DPS * computePressure(0)).toBeCloseTo(19.2);
    expect(BASELINE_PLAYER_DPS * computePressure(120)).toBeCloseTo(38.4);
    expect(BASELINE_PLAYER_DPS * computePressure(180)).toBeCloseTo(76.8);
  });

  test("pressure is unbounded (exceeds old cap)", () => {
    expect(computePressure(9999)).toBeGreaterThan(50);
  });
});
