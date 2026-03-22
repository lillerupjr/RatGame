import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG,
  SHADOW_SUN_V1_MAX_PROJECTION_SCALE,
  SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG,
  getShadowSunV1Model,
} from "../../../../shadowSunV1";

describe("shadowSunV1", () => {
  it("clamps and rounds timeHour to the daylight window", () => {
    expect(getShadowSunV1Model(6.1).timeHour).toBe(7);
    expect(getShadowSunV1Model(19.9).timeHour).toBe(19);
    expect(getShadowSunV1Model(12.6).timeHour).toBe(13);
    expect(getShadowSunV1Model(Number.NaN).timeHour).toBe(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
  });

  it("matches locked anchor points at sunrise, noon, and sunset", () => {
    const sunrise = getShadowSunV1Model(7);
    const noon = getShadowSunV1Model(13);
    const sunset = getShadowSunV1Model(19);

    expect(sunrise.timeLabel).toBe("07:00");
    expect(sunrise.elevationDeg).toBe(0);
    expect(sunrise.directionLabel).toBe("NE");

    expect(noon.timeLabel).toBe("13:00");
    expect(noon.elevationDeg).toBe(55);
    expect(noon.directionLabel).toBe("SE");

    expect(sunset.timeLabel).toBe("19:00");
    expect(sunset.elevationDeg).toBe(0);
    expect(sunset.directionLabel).toBe("SW");
  });

  it("follows the horizontal path NE -> SE -> SW with deterministic intermediates", () => {
    const morningMid = getShadowSunV1Model(10);
    const afternoonMid = getShadowSunV1Model(16);

    expect(morningMid.directionLabel).toBe("E");
    expect(morningMid.forward.x).toBeGreaterThan(0);
    expect(morningMid.forward.y).toBeGreaterThan(0);

    expect(afternoonMid.directionLabel).toBe("S");
    expect(afternoonMid.forward.x).toBeLessThan(0);
    expect(afternoonMid.forward.y).toBeGreaterThan(0);
  });

  it("uses full-vector projection and caps horizon projection scale", () => {
    const noon = getShadowSunV1Model(13);
    const expectedNoonProjectionX = -noon.forward.x / Math.abs(noon.forward.z);
    const expectedNoonProjectionY = -noon.forward.y / Math.abs(noon.forward.z);
    expect(noon.projectionDirection.x).toBeCloseTo(expectedNoonProjectionX, 6);
    expect(noon.projectionDirection.y).toBeCloseTo(expectedNoonProjectionY, 6);

    const sunrise = getShadowSunV1Model(7);
    const sunset = getShadowSunV1Model(19);
    expect(Math.hypot(sunrise.projectionDirection.x, sunrise.projectionDirection.y)).toBeCloseTo(
      SHADOW_SUN_V1_MAX_PROJECTION_SCALE,
      6,
    );
    expect(Math.hypot(sunset.projectionDirection.x, sunset.projectionDirection.y)).toBeCloseTo(
      SHADOW_SUN_V1_MAX_PROJECTION_SCALE,
      6,
    );
  });

  it("produces deterministic hour-step cache keys", () => {
    expect(getShadowSunV1Model(13).stepKey).toBe("sun-v1:h13");
    expect(getShadowSunV1Model(13).stepKey).toBe(getShadowSunV1Model(13).stepKey);
    expect(getShadowSunV1Model(12).stepKey).not.toBe(getShadowSunV1Model(13).stepKey);
  });

  it("keeps behavior unchanged when elevation override is disabled", () => {
    const baseline = getShadowSunV1Model(15);
    const disabledOverride = getShadowSunV1Model(15, {
      sunElevationOverrideEnabled: false,
      sunElevationOverrideDeg: 20,
    });
    expect(disabledOverride.elevationDeg).toBeCloseTo(baseline.elevationDeg, 6);
    expect(disabledOverride.forward.x).toBeCloseTo(baseline.forward.x, 6);
    expect(disabledOverride.forward.y).toBeCloseTo(baseline.forward.y, 6);
    expect(disabledOverride.forward.z).toBeCloseTo(baseline.forward.z, 6);
    expect(disabledOverride.projectionDirection.x).toBeCloseTo(baseline.projectionDirection.x, 6);
    expect(disabledOverride.projectionDirection.y).toBeCloseTo(baseline.projectionDirection.y, 6);
    expect(disabledOverride.stepKey).toBe(baseline.stepKey);
  });

  it("applies override elevation immediately while keeping direction time-driven", () => {
    const timeBased = getShadowSunV1Model(10);
    const overridden = getShadowSunV1Model(10, {
      sunElevationOverrideEnabled: true,
      sunElevationOverrideDeg: 20,
    });
    expect(overridden.directionLabel).toBe(timeBased.directionLabel);
    expect(overridden.elevationDeg).toBe(20);
    expect(overridden.forward.x).toBeGreaterThan(0);
    expect(overridden.forward.y).toBeGreaterThan(0);
    expect(overridden.projectionDirection.x).not.toBeCloseTo(timeBased.projectionDirection.x, 6);
    expect(overridden.projectionDirection.y).not.toBeCloseTo(timeBased.projectionDirection.y, 6);
  });

  it("clamps override elevation to safe non-degenerate bounds", () => {
    const low = getShadowSunV1Model(13, {
      sunElevationOverrideEnabled: true,
      sunElevationOverrideDeg: -10,
    });
    const high = getShadowSunV1Model(13, {
      sunElevationOverrideEnabled: true,
      sunElevationOverrideDeg: 120,
    });
    expect(low.elevationDeg).toBe(SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG);
    expect(high.elevationDeg).toBe(SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG);
  });

  it("includes override elevation in step key when override is enabled", () => {
    const off = getShadowSunV1Model(13);
    const on20 = getShadowSunV1Model(13, {
      sunElevationOverrideEnabled: true,
      sunElevationOverrideDeg: 20,
    });
    const on25 = getShadowSunV1Model(13, {
      sunElevationOverrideEnabled: true,
      sunElevationOverrideDeg: 25,
    });
    expect(on20.stepKey).not.toBe(off.stepKey);
    expect(on20.stepKey).not.toBe(on25.stepKey);
  });
});
