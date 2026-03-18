import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEBUG_TOOLS_SETTINGS,
  sanitizeDebugToolsSettings,
} from "../../settings/debugToolsSettings";
import {
  DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  SHADOW_SUN_V1_DAYLIGHT_END_HOUR,
  SHADOW_SUN_V1_DAYLIGHT_START_HOUR,
} from "../../shadowSunV1";
import {
  DEFAULT_USER_SETTINGS,
  sanitizeUserSettings,
} from "../../settings/userSettings";
import {
  DEFAULT_SYSTEM_OVERRIDES,
  sanitizeSystemOverrides,
} from "../../settings/systemOverrides";

describe("settings bucket defaults", () => {
  it("debug defaults keep boolean toggles OFF and sun hour at noon", () => {
    const debug = DEFAULT_DEBUG_TOOLS_SETTINGS;
    const {
      shadowSunTimeHour,
      shadowV1DebugGeometryMode,
      shadowCasterMode,
      ...booleanFlags
    } = debug;
    for (const [key, value] of Object.entries(booleanFlags)) {
      expect(value, key).toBe(false);
    }
    expect(shadowSunTimeHour).toBe(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
    expect(shadowV1DebugGeometryMode).toBe("full");
    expect(shadowCasterMode).toBe("v2AlphaSilhouette");
  });

  it("sanitizes debug shadow sun hour to daylight range with hourly steps", () => {
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: SHADOW_SUN_V1_DAYLIGHT_START_HOUR - 4 }).shadowSunTimeHour)
      .toBe(SHADOW_SUN_V1_DAYLIGHT_START_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: SHADOW_SUN_V1_DAYLIGHT_END_HOUR + 4 }).shadowSunTimeHour)
      .toBe(SHADOW_SUN_V1_DAYLIGHT_END_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: 12.6 }).shadowSunTimeHour).toBe(13);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: Number.NaN }).shadowSunTimeHour)
      .toBe(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowV1DebugGeometryMode: "capOnly" }).shadowV1DebugGeometryMode)
      .toBe("capOnly");
    expect(sanitizeDebugToolsSettings({ shadowV1DebugGeometryMode: "invalid" as any }).shadowV1DebugGeometryMode)
      .toBe("full");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "v1Roof" as any }).shadowCasterMode)
      .toBe("v1Roof");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "invalid" as any }).shadowCasterMode)
      .toBe("v2AlphaSilhouette");
  });

  it("sanitizes user settings ranges and enums", () => {
    const sanitized = sanitizeUserSettings({
      game: { healthOrbSide: "invalid" as any },
      audio: { masterVolume: 2, musicVolume: -1, sfxVolume: NaN },
      graphics: { verticalTilesMode: "bad" as any, verticalTilesUser: 999 },
    });

    expect(sanitized.game.healthOrbSide).toBe("left");
    expect(sanitized.audio.masterVolume).toBe(1);
    expect(sanitized.audio.musicVolume).toBe(0);
    expect(sanitized.audio.sfxVolume).toBe(DEFAULT_USER_SETTINGS.audio.sfxVolume);
    expect(sanitized.graphics.verticalTilesMode).toBe("auto");
    expect(sanitized.graphics.verticalTilesUser).toBeLessThanOrEqual(24);
  });

  it("sanitizes system overrides", () => {
    const sanitized = sanitizeSystemOverrides({
      gameSpeed: 99,
      paletteSWeightPercent: 62 as any,
      staticRelightTargetDarknessPercent: 61 as any,
      spawnPerDepth: 99,
      paletteGroup: "test",
      paletteId: "unknown",
    } as any);

    expect(sanitized.gameSpeed).toBeLessThanOrEqual(1.5);
    expect(sanitized.paletteSWeightPercent).toBe(50);
    expect(sanitized.staticRelightTargetDarknessPercent).toBe(50);
    expect(sanitized.spawnPerDepth).toBeLessThanOrEqual(1.5);
    expect(sanitized.paletteId.length).toBeGreaterThan(0);
    expect(DEFAULT_SYSTEM_OVERRIDES.gameSpeed).toBe(1);
  });
});
