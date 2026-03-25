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
      shadowSunAzimuthDeg,
      sunElevationOverrideEnabled,
      sunElevationOverrideDeg,
      shadowCasterMode,
      shadowV6SemanticBucket,
      shadowV6StructureIndex,
      shadowV6SliceCount,
      shadowV6AllStructures,
      shadowV6OneStructureOnly,
      shadowV6VerticalOnly,
      shadowV6TopOnly,
      shadowV6ForceRefresh,
      ...booleanFlags
    } = debug;
    for (const [key, value] of Object.entries(booleanFlags)) {
      expect(value, key).toBe(false);
    }
    expect(shadowSunTimeHour).toBe(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
    expect(shadowSunAzimuthDeg).toBe(-1);
    expect(sunElevationOverrideEnabled).toBe(false);
    expect(sunElevationOverrideDeg).toBe(DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG);
    expect(shadowCasterMode).toBe("v6SweepShadow");
    expect(shadowV6SemanticBucket).toBe("EAST_WEST");
    expect(shadowV6StructureIndex).toBe(0);
    expect(shadowV6SliceCount).toBe(8);
    expect(shadowV6AllStructures).toBe(true);
    expect(shadowV6OneStructureOnly).toBe(false);
    expect(shadowV6VerticalOnly).toBe(false);
    expect(shadowV6TopOnly).toBe(false);
    expect(shadowV6ForceRefresh).toBe(false);
  });

  it("sanitizes debug shadow sun hour to daylight range with hourly steps", () => {
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: SHADOW_SUN_V1_DAYLIGHT_START_HOUR - 4 }).shadowSunTimeHour)
      .toBe(SHADOW_SUN_V1_DAYLIGHT_START_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: SHADOW_SUN_V1_DAYLIGHT_END_HOUR + 4 }).shadowSunTimeHour)
      .toBe(SHADOW_SUN_V1_DAYLIGHT_END_HOUR);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: 12.6 }).shadowSunTimeHour).toBe(13);
    expect(sanitizeDebugToolsSettings({ shadowSunTimeHour: Number.NaN }).shadowSunTimeHour)
      .toBe(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
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
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "v6SweepShadow" as any }).shadowCasterMode)
      .toBe("v6SweepShadow");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "v6FaceSliceDebug" as any }).shadowCasterMode)
      .toBe("v6FaceSliceDebug");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "invalid" as any }).shadowCasterMode)
      .toBe("v6SweepShadow");
    expect(sanitizeDebugToolsSettings({ shadowV6SemanticBucket: "TOP" as any }).shadowV6SemanticBucket)
      .toBe("TOP");
    expect(sanitizeDebugToolsSettings({ shadowV6SemanticBucket: "bad" as any }).shadowV6SemanticBucket)
      .toBe("EAST_WEST");
    expect(sanitizeDebugToolsSettings({ shadowV6StructureIndex: -4 }).shadowV6StructureIndex)
      .toBe(0);
    expect(sanitizeDebugToolsSettings({ shadowV6StructureIndex: 999 }).shadowV6StructureIndex)
      .toBe(127);
    expect(sanitizeDebugToolsSettings({ shadowV6SliceCount: 0 }).shadowV6SliceCount)
      .toBe(1);
    expect(sanitizeDebugToolsSettings({ shadowV6SliceCount: 99 }).shadowV6SliceCount)
      .toBe(32);
    expect(sanitizeDebugToolsSettings({ shadowV6AllStructures: 0 as any }).shadowV6AllStructures)
      .toBe(false);
    expect(sanitizeDebugToolsSettings({ shadowV6OneStructureOnly: 1 as any }).shadowV6OneStructureOnly)
      .toBe(true);
    expect(sanitizeDebugToolsSettings({ shadowV6VerticalOnly: 1 as any }).shadowV6VerticalOnly)
      .toBe(true);
    expect(sanitizeDebugToolsSettings({ shadowV6TopOnly: "" as any }).shadowV6TopOnly)
      .toBe(false);
    expect(sanitizeDebugToolsSettings({ shadowV6ForceRefresh: 1 as any }).shadowV6ForceRefresh)
      .toBe(true);
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
    expect(DEFAULT_SYSTEM_OVERRIDES.darknessMaskDebugDisabled).toBe(true);
  });
});
