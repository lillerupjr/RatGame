import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  SHADOW_SUN_V1_MAX_PROJECTION_SCALE,
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
});
