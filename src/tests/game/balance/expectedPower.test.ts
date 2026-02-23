import { describe, expect, test } from "vitest";
import { expectedDpsAtProgress, expectedDpsAtTime, type ExpectedPowerConfig } from "../../../game/balance/expectedPower";

const cfg: ExpectedPowerConfig = {
  timeCurve: [
    { tSec: 0, dps: 8 },
    { tSec: 120, dps: 14 },
    { tSec: 300, dps: 28 },
    { tSec: 480, dps: 45 },
    { tSec: 720, dps: 70 },
  ],
  depthMultBase: 1.0,
  depthMultPerDepth: 0.05,
  depthMultMin: 1.0,
  depthMultMax: 1.8,
};

describe("expectedPower", () => {
  test("returns exact endpoint values", () => {
    expect(expectedDpsAtTime(cfg, 0)).toBeCloseTo(8);
    expect(expectedDpsAtTime(cfg, 720)).toBeCloseTo(70);
    expect(expectedDpsAtTime(cfg, 9999)).toBeCloseTo(70);
  });

  test("interpolates linearly between points", () => {
    expect(expectedDpsAtTime(cfg, 60)).toBeCloseTo(11);
    expect(expectedDpsAtTime(cfg, 210)).toBeCloseTo(21);
  });

  test("depth multiplier clamps", () => {
    expect(expectedDpsAtProgress(cfg, 120, -999)).toBeCloseTo(14);
    expect(expectedDpsAtProgress(cfg, 120, 999)).toBeCloseTo(14 * 1.8);
  });
});

