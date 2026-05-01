import { describe, expect, it } from "vitest";
import type { World } from "../../../../engine/world/world";
import { getShadowSunV1Model } from "../../../../shadowSunV1";
import { resolveShadowSunDayCycleRuntime } from "../../../../game/systems/presentation/shadowSunDayCycleRuntime";

function makeWorld(state: World["state"]): World {
  return { state } as World;
}

describe("shadowSunDayCycleRuntime", () => {
  it("returns the manual hour unchanged while continuous sun mode is disabled", () => {
    const resolved = resolveShadowSunDayCycleRuntime({
      world: makeWorld("RUN"),
      manualSeedHour: 13,
      enabled: false,
      cycleMode: "full24h",
      speedMultiplier: 64,
      stepsPerDay: 288,
      dtRealSec: 30,
    });

    expect(resolved.continuousTimeHour).toBe(13);
    expect(resolved.quantizedTimeHour).toBe(13);
    expect(resolved.effectiveTimeHour).toBe(13);
    expect(resolved.shadowStepKeyOverride).toBeUndefined();
    expect(resolved.status.enabled).toBe(false);
    expect(resolved.status.cycleMode).toBe("full24h");
    expect(resolved.status.stepsPerDay).toBe(288);
    expect(resolved.status.stepIndex).toBe(156);
    expect(resolved.status.effectiveTimeLabel).toBe("13:00");
  });

  it("keeps continuous time separate from quantized shadow time at 1x", () => {
    const world = makeWorld("RUN");
    resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 13,
      enabled: true,
      cycleMode: "dayOnly",
      speedMultiplier: 1,
      stepsPerDay: 96,
      dtRealSec: 0,
    });

    const resolved = resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 13,
      enabled: true,
      cycleMode: "dayOnly",
      speedMultiplier: 1,
      stepsPerDay: 96,
      dtRealSec: 1,
    });

    expect(resolved.continuousTimeHour).toBeCloseTo(13 + (1 / 60), 6);
    expect(resolved.quantizedTimeHour).toBe(13);
    expect(resolved.effectiveTimeHour).toBe(13);
    expect(resolved.status.continuousTimeLabel).toBe("13:01");
    expect(resolved.status.quantizedTimeLabel).toBe("13:00");
    expect(resolved.status.stepIndex).toBe(48);
    expect(resolved.status.stepChanged).toBe(false);
    expect(resolved.status.advancementClamped).toBe(false);
    expect(resolved.shadowStepKeyOverride).toBe("sun-v1:cont:dayOnly:spd96:step48");
    expect(getShadowSunV1Model(resolved.effectiveTimeHour).timeHour).toBe(13);
  });

  it("clamps high-speed advancement to one quantized step per render frame", () => {
    const world = makeWorld("RUN");
    const resolved = resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 13,
      enabled: true,
      cycleMode: "dayOnly",
      speedMultiplier: 64,
      stepsPerDay: 96,
      dtRealSec: 1,
    });

    expect(resolved.continuousTimeHour).toBeCloseTo(13.125, 6);
    expect(resolved.quantizedTimeHour).toBeCloseTo(13.125, 6);
    expect(resolved.status.continuousTimeLabel).toBe("13:07");
    expect(resolved.status.quantizedTimeLabel).toBe("13:07");
    expect(resolved.status.stepIndex).toBe(49);
    expect(resolved.status.stepChanged).toBe(true);
    expect(resolved.status.advancementClamped).toBe(true);
    expect(resolved.status.stepSpanMinutes).toBe(7.5);
    expect(resolved.shadowStepKeyOverride).toBe("sun-v1:cont:dayOnly:spd96:step49");
  });

  it("reseeds and wraps across the daylight window in day-only mode", () => {
    const world = makeWorld("RUN");
    const resolved = resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 19,
      enabled: true,
      cycleMode: "dayOnly",
      speedMultiplier: 64,
      stepsPerDay: 96,
      dtRealSec: 1,
    });

    expect(resolved.status.continuousTimeLabel).toBe("07:07");
    expect(resolved.status.quantizedTimeLabel).toBe("07:07");
    expect(resolved.status.stepIndex).toBe(1);
    expect(resolved.shadowStepKeyOverride).toBe("sun-v1:cont:dayOnly:spd96:step1");
  });

  it("runs through night and wraps at 24:00 in full-24h mode", () => {
    const world = makeWorld("RUN");
    const resolved = resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 19,
      enabled: true,
      cycleMode: "full24h",
      speedMultiplier: 64,
      stepsPerDay: 96,
      dtRealSec: 1,
    });

    expect(resolved.status.continuousTimeLabel).toBe("19:15");
    expect(resolved.status.quantizedTimeLabel).toBe("19:15");
    expect(resolved.status.stepIndex).toBe(77);
    expect(resolved.status.stepSpanMinutes).toBe(15);
    expect(resolved.shadowStepKeyOverride).toBe("sun-v1:cont:full24h:spd96:step77");
  });

  it("recomputes quantized steps when steps-per-day changes", () => {
    const world = makeWorld("RUN");
    resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 13,
      enabled: true,
      cycleMode: "full24h",
      speedMultiplier: 1,
      stepsPerDay: 96,
      dtRealSec: 0,
    });

    const resolved = resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 13,
      enabled: true,
      cycleMode: "full24h",
      speedMultiplier: 1,
      stepsPerDay: 288,
      dtRealSec: 0,
    });

    expect(resolved.quantizedTimeHour).toBe(13);
    expect(resolved.status.stepsPerDay).toBe(288);
    expect(resolved.status.stepIndex).toBe(156);
    expect(resolved.status.stepChanged).toBe(true);
    expect(resolved.shadowStepKeyOverride).toBe("sun-v1:cont:full24h:spd288:step156");
  });

  it("freezes automatic progression outside the active run world state", () => {
    const mapWorld = makeWorld("MAP");
    const rewardWorld = makeWorld("REWARD");

    const mapResolved = resolveShadowSunDayCycleRuntime({
      world: mapWorld,
      manualSeedHour: 12,
      enabled: true,
      cycleMode: "full24h",
      speedMultiplier: 16,
      stepsPerDay: 144,
      dtRealSec: 60,
    });
    const rewardResolved = resolveShadowSunDayCycleRuntime({
      world: rewardWorld,
      manualSeedHour: 15,
      enabled: true,
      cycleMode: "dayOnly",
      speedMultiplier: 16,
      stepsPerDay: 144,
      dtRealSec: 60,
    });

    expect(mapResolved.status.advancing).toBe(false);
    expect(mapResolved.status.effectiveTimeLabel).toBe("12:00");
    expect(mapResolved.status.stepChanged).toBe(true);
    expect(rewardResolved.status.advancing).toBe(false);
    expect(rewardResolved.status.effectiveTimeLabel).toBe("15:00");
    expect(rewardResolved.status.stepChanged).toBe(true);
  });

  it("keeps azimuth and elevation overrides compatible with the quantized runtime hour", () => {
    const world = makeWorld("RUN");
    const resolved = resolveShadowSunDayCycleRuntime({
      world,
      manualSeedHour: 10,
      enabled: true,
      cycleMode: "dayOnly",
      speedMultiplier: 64,
      stepsPerDay: 288,
      dtRealSec: 1,
    });

    const overridden = getShadowSunV1Model(resolved.effectiveTimeHour, {
      shadowSunAzimuthDeg: 90,
      sunElevationOverrideEnabled: true,
      sunElevationOverrideDeg: 20,
    });

    expect(overridden.directionLabel).toBe("NE");
    expect(overridden.elevationDeg).toBe(20);
  });
});
