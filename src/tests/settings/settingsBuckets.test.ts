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
      shadowHybridDiagnosticMode,
      shadowDebugMode,
      shadowV5DebugView,
      ...booleanFlags
    } = debug;
    for (const [key, value] of Object.entries(booleanFlags)) {
      expect(value, key).toBe(false);
    }
    expect(shadowSunTimeHour).toBe(DEFAULT_SHADOW_SUN_V1_TIME_HOUR);
    expect(shadowV1DebugGeometryMode).toBe("full");
    expect(shadowCasterMode).toBe("v3HybridTriangles");
    expect(shadowHybridDiagnosticMode).toBe("off");
    expect(shadowDebugMode).toBe("warpedOnly");
    expect(shadowV5DebugView).toBe("finalOnly");
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
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "v2AlphaSilhouette" as any }).shadowCasterMode)
      .toBe("v2AlphaSilhouette");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "v3HybridTriangles" as any }).shadowCasterMode)
      .toBe("v3HybridTriangles");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "v4SliceStrips" as any }).shadowCasterMode)
      .toBe("v4SliceStrips");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "v5TriangleShadowMask" as any }).shadowCasterMode)
      .toBe("v5TriangleShadowMask");
    expect(sanitizeDebugToolsSettings({ shadowCasterMode: "invalid" as any }).shadowCasterMode)
      .toBe("v3HybridTriangles");
    expect(sanitizeDebugToolsSettings({ shadowHybridDiagnosticMode: "solidShadowPass" as any }).shadowHybridDiagnosticMode)
      .toBe("solidShadowPass");
    expect(sanitizeDebugToolsSettings({ shadowHybridDiagnosticMode: "solidMainCanvas" as any }).shadowHybridDiagnosticMode)
      .toBe("solidMainCanvas");
    expect(sanitizeDebugToolsSettings({ shadowHybridDiagnosticMode: "invalid" as any }).shadowHybridDiagnosticMode)
      .toBe("off");
    expect(sanitizeDebugToolsSettings({ shadowDebugMode: "flatOnly" as any }).shadowDebugMode)
      .toBe("flatOnly");
    expect(sanitizeDebugToolsSettings({ shadowDebugMode: "both" as any }).shadowDebugMode)
      .toBe("both");
    expect(sanitizeDebugToolsSettings({ shadowDebugMode: "invalid" as any }).shadowDebugMode)
      .toBe("warpedOnly");
    expect(sanitizeDebugToolsSettings({ shadowV5DebugView: "topMask" as any }).shadowV5DebugView)
      .toBe("topMask");
    expect(sanitizeDebugToolsSettings({ shadowV5DebugView: "eastWestMask" as any }).shadowV5DebugView)
      .toBe("eastWestMask");
    expect(sanitizeDebugToolsSettings({ shadowV5DebugView: "southNorthMask" as any }).shadowV5DebugView)
      .toBe("southNorthMask");
    expect(sanitizeDebugToolsSettings({ shadowV5DebugView: "all" as any }).shadowV5DebugView)
      .toBe("all");
    expect(sanitizeDebugToolsSettings({ shadowV5DebugView: "invalid" as any }).shadowV5DebugView)
      .toBe("finalOnly");
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
