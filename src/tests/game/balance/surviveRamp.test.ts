import { describe, expect, test } from "vitest";
import { buildSurviveSpawnOverrides, SURVIVE_RAMP_CONFIG } from "../../../game/balance/surviveRamp";

describe("surviveRamp", () => {
  test("starts with configured baseline and no elite chance", () => {
    const out = buildSurviveSpawnOverrides(0);
    expect(out.progress).toBeCloseTo(0);
    expect(out.ramp).toBeCloseTo(1);
    expect(out.powerPerSecondOverride).toBeCloseTo(SURVIVE_RAMP_CONFIG.basePowerPerSecond);
    expect(out.waveChunkOverride).toBe(3);
    expect(out.waveDelayOverride).toBeCloseTo(1.0);
    expect(out.eliteChanceOverride).toBeCloseTo(0);
  });

  test("reaches end-of-run chunk and delay targets at 120s", () => {
    const out = buildSurviveSpawnOverrides(120);
    expect(out.progress).toBeCloseTo(1);
    expect(out.waveChunkOverride).toBe(6);
    expect(out.waveDelayOverride).toBeCloseTo(0.55);
    expect(out.eliteChanceOverride).toBeCloseTo(0.10);
  });

  test("elite chance only turns on at 60s", () => {
    const before = buildSurviveSpawnOverrides(59.999);
    const at = buildSurviveSpawnOverrides(60);
    expect(before.eliteChanceOverride).toBeCloseTo(0);
    expect(at.eliteChanceOverride).toBeCloseTo(0.10);
  });
});
