import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEBUG_TOOLS_SETTINGS,
  sanitizeDebugToolsSettings,
} from "../../settings/debugToolsSettings";
import {
  DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG,
  DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  SHADOW_SUN_V1_DAYLIGHT_END_HOUR,
  SHADOW_SUN_V1_DAYLIGHT_START_HOUR,
  SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG,
  SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG,
} from "../../shadowSunV1";
import {
  DEFAULT_SHADOW_SUN_CYCLE_MODE,
  DEFAULT_SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIER,
  DEFAULT_SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY,
} from "../../shadowSunDayCycle";
import {
  DEFAULT_USER_SETTINGS,
  sanitizeUserSettings,
} from "../../settings/userSettings";
import {
  DEFAULT_SYSTEM_OVERRIDES,
  sanitizeSystemOverrides,
} from "../../settings/systemOverrides";

describe("settings bucket defaults", () => {
  it("debug defaults keep boolean toggles OFF and seed the sun validation controls", () => {
    const debug = DEFAULT_DEBUG_TOOLS_SETTINGS;
    const {
      shadowSunTimeHour,
      shadowSunDayCycleEnabled,
      shadowSunCycleMode,
      shadowSunDayCycleSpeedMultiplier,
      shadowSunStepsPerDay,
      staticLightCycleOverride,
      shadowSunAzimuthDeg,
      sunElevationOverrideEnabled,
      sunElevationOverrideDeg,
      perfOverlayMode,
      ...booleanFlags
    } = debug;
    for (const [key, value] of Object.entries(booleanFlags)) {
      expect(value, key).toBe(false);
    }
    expect(shadowSunTimeHour).toBe(17);
    expect(shadowSunDayCycleEnabled).toBe(true);
    expect(shadowSunCycleMode).toBe(DEFAULT_SHADOW_SUN_CYCLE_MODE);
    expect(shadowSunDayCycleSpeedMultiplier).toBe(DEFAULT_SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIER);
    expect(shadowSunStepsPerDay).toBe(144);
    expect(staticLightCycleOverride).toBe("automatic");
    expect(shadowSunAzimuthDeg).toBe(-1);
    expect(sunElevationOverrideEnabled).toBe(false);
    expect(sunElevationOverrideDeg).toBe(45);
    expect(perfOverlayMode).toBe("overview");
  });

  it("sanitizes debug shadow sun hour to daylight range with hourly steps", () => {
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: SHADOW_SUN_V1_DAYLIGHT_START_HOUR - 4 }).shadowSunTimeHour)
      .toBe(SHADOW_SUN_V1_DAYLIGHT_START_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: SHADOW_SUN_V1_DAYLIGHT_END_HOUR + 4 }).shadowSunTimeHour)
      .toBe(SHADOW_SUN_V1_DAYLIGHT_END_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: 12.6 }).shadowSunTimeHour).toBe(13);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: Number.NaN }).shadowSunTimeHour)
      .toBe(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowSunDayCycleEnabled: 1 as any }).shadowSunDayCycleEnabled)
      .toBe(true);
    expect(sanitizeDebugToolsSettings({ shadowSunCycleMode: "dayOnly" as any }).shadowSunCycleMode)
      .toBe("dayOnly");
    expect(sanitizeDebugToolsSettings({ shadowSunCycleMode: "invalid" as any }).shadowSunCycleMode)
      .toBe(DEFAULT_SHADOW_SUN_CYCLE_MODE);
    expect(sanitizeDebugToolsSettings({ shadowSunDayCycleSpeedMultiplier: 64 as any }).shadowSunDayCycleSpeedMultiplier)
      .toBe(64);
    expect(sanitizeDebugToolsSettings({ shadowSunDayCycleSpeedMultiplier: 3 as any }).shadowSunDayCycleSpeedMultiplier)
      .toBe(DEFAULT_SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIER);
    expect(sanitizeDebugToolsSettings({ shadowSunStepsPerDay: 144 as any }).shadowSunStepsPerDay)
      .toBe(144);
    expect(sanitizeDebugToolsSettings({ shadowSunStepsPerDay: 12 as any }).shadowSunStepsPerDay)
      .toBe(DEFAULT_SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY);
    expect(sanitizeDebugToolsSettings({ staticLightCycleOverride: "on" as any }).staticLightCycleOverride)
      .toBe("on");
    expect(sanitizeDebugToolsSettings({ staticLightCycleOverride: "__bad__" as any }).staticLightCycleOverride)
      .toBe("automatic");
    expect(sanitizeDebugToolsSettings({ sunElevationOverrideEnabled: 1 as any }).sunElevationOverrideEnabled)
      .toBe(true);
    expect(sanitizeDebugToolsSettings({ shadowSunAzimuthDeg: -5 }).shadowSunAzimuthDeg).toBe(-1);
    expect(sanitizeDebugToolsSettings({ shadowSunAzimuthDeg: 361 }).shadowSunAzimuthDeg).toBe(1);
    expect(sanitizeDebugToolsSettings({ shadowSunAzimuthDeg: Number.NaN }).shadowSunAzimuthDeg).toBe(-1);
    expect(sanitizeDebugToolsSettings({ sunElevationOverrideDeg: SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG - 10 })
      .sunElevationOverrideDeg)
      .toBe(SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG);
    expect(sanitizeDebugToolsSettings({ sunElevationOverrideDeg: SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG + 10 })
      .sunElevationOverrideDeg)
      .toBe(SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG);
    expect(sanitizeDebugToolsSettings({ sunElevationOverrideDeg: Number.NaN }).sunElevationOverrideDeg)
      .toBe(DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG);
    expect(sanitizeDebugToolsSettings({ perfOverlayMode: "off" as any }).perfOverlayMode)
      .toBe("off");
    expect(sanitizeDebugToolsSettings({ perfOverlayMode: "textures" as any }).perfOverlayMode)
      .toBe("textures");
    expect(sanitizeDebugToolsSettings({ perfOverlayMode: "bad" as any }).perfOverlayMode)
      .toBe("overview");
    expect(sanitizeDebugToolsSettings({ sweepShadowDebug: 1 as any }).sweepShadowDebug)
      .toBe(true);
    expect(sanitizeDebugToolsSettings({ tileHeightMap: 0 as any }).tileHeightMap)
      .toBe(false);
  });

  it("sanitizes user settings ranges and enums", () => {
    const sanitized = sanitizeUserSettings({
      game: { healthOrbSide: "invalid" as any },
      audio: { masterVolume: 2, musicVolume: -1, sfxVolume: NaN },
      graphics: { verticalTilesMode: "bad" as any, verticalTilesUser: 999, renderBackend: "broken" as any },
    });

    expect(sanitized.game.healthOrbSide).toBe("left");
    expect(sanitized.audio.masterVolume).toBe(1);
    expect(sanitized.audio.musicVolume).toBe(0);
    expect(sanitized.audio.sfxVolume).toBe(DEFAULT_USER_SETTINGS.audio.sfxVolume);
    expect(sanitized.graphics.renderBackend).toBe("canvas2d");
    expect(sanitized.graphics.verticalTilesMode).toBe("auto");
    expect(sanitized.graphics.verticalTilesUser).toBeLessThanOrEqual(24);
  });

  it("sanitizes system overrides", () => {
    const sanitized = sanitizeSystemOverrides({
      gameSpeed: 99,
      paletteSWeightPercent: 62 as any,
      spawnPerDepth: 99,
      paletteGroup: "test",
      paletteId: "unknown",
      worldAtlasMode: "bogus" as any,
    } as any);

    expect(sanitized.gameSpeed).toBeLessThanOrEqual(1.5);
    expect(sanitized.paletteSWeightPercent).toBe(50);
    expect(sanitized.spawnPerDepth).toBeLessThanOrEqual(1.5);
    expect(sanitized.paletteId.length).toBeGreaterThan(0);
    expect(sanitized.worldAtlasMode).toBe("dual");
    expect(DEFAULT_SYSTEM_OVERRIDES.gameSpeed).toBe(1);
    expect(DEFAULT_SYSTEM_OVERRIDES.darknessMaskDebugDisabled).toBe(true);
    expect(DEFAULT_SYSTEM_OVERRIDES.worldAtlasMode).toBe("dual");
  });
});
