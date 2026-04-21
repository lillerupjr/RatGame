import { describe, expect, it } from "vitest";
import { getUserSettings, updateUserSettings } from "../../userSettings";
import { getFirstPaletteInGroup, getPalettesByGroup } from "../../engine/render/palette/palettes";

describe("userSettings palette darkness merge", () => {
  it("ignores unknown debug patch keys", () => {
    updateUserSettings({
      debug: {
        paletteDarknessPercent: 0,
      },
    });

    updateUserSettings({
      debug: {
        __unknownDebugKey: 100,
      } as any,
    });

    expect(getUserSettings().debug.paletteDarknessPercent).toBe(0);
  });

  it("normalizes paletteDarknessPercent to nearest allowed value", () => {
    updateUserSettings({
      debug: {
        paletteDarknessPercent: 62 as any,
      },
    });

    expect(getUserSettings().debug.paletteDarknessPercent).toBe(50);
  });

  it("snaps palette id to a valid id when palette group changes", () => {
    updateUserSettings({
      render: {
        paletteGroup: "live",
        paletteId: "db32",
      },
    } as any);

    updateUserSettings({
      render: {
        paletteGroup: "test",
      },
    } as any);

    const render = getUserSettings().render;
    const testPaletteIds = getPalettesByGroup("test").map((palette) => palette.id);

    expect(render.paletteGroup).toBe("test");
    expect(testPaletteIds).toContain(render.paletteId);
  });

  it("snaps unknown palette id to the first palette in the active group", () => {
    const firstTestPalette = getFirstPaletteInGroup("test");
    updateUserSettings({
      render: {
        paletteGroup: "test",
        paletteId: "__unknown__",
      },
    } as any);

    expect(getUserSettings().render.paletteId).toBe(firstTestPalette.id);
  });

  it("normalizes light override values to safe defaults", () => {
    updateUserSettings({
      render: {
        lightColorModeOverride: "__bad__",
        lightStrengthOverride: "__bad__",
      } as any,
    });

    expect(getUserSettings().render.lightColorModeOverride).toBe("authored");
    expect(getUserSettings().render.lightStrengthOverride).toBe("authored");
  });

  it("normalizes and persists structure triangle admission mode", () => {
    updateUserSettings({
      render: {
        structureTriangleAdmissionMode: "__bad__" as any,
      },
    } as any);
    expect(getUserSettings().render.structureTriangleAdmissionMode).toBe("hybrid");

    updateUserSettings({
      render: {
        structureTriangleAdmissionMode: "renderDistance",
      },
    } as any);
    expect(getUserSettings().render.structureTriangleAdmissionMode).toBe("renderDistance");
  });

  it("normalizes and persists structure triangle cutout settings", () => {
    updateUserSettings({
      render: {
        structureTriangleCutoutWidth: 99 as any,
        structureTriangleCutoutHeight: -6 as any,
        structureTriangleCutoutAlpha: 3.5 as any,
      },
    } as any);
    expect(getUserSettings().render.structureTriangleCutoutWidth).toBe(12);
    expect(getUserSettings().render.structureTriangleCutoutHeight).toBe(0);
    expect(getUserSettings().render.structureTriangleCutoutAlpha).toBe(1);

    updateUserSettings({
      render: {
        structureTriangleCutoutEnabled: true,
        structureTriangleCutoutWidth: 3,
        structureTriangleCutoutHeight: 4,
        structureTriangleCutoutAlpha: 0.35,
      },
    } as any);
    expect(getUserSettings().render.structureTriangleCutoutEnabled).toBe(true);
    expect(getUserSettings().render.structureTriangleCutoutWidth).toBe(3);
    expect(getUserSettings().render.structureTriangleCutoutHeight).toBe(4);
    expect(getUserSettings().render.structureTriangleCutoutAlpha).toBe(0.35);
  });

  it("bridges day-cycle debug controls into the bucketed settings store", () => {
    updateUserSettings({
      debug: {
        shadowSunDayCycleEnabled: true,
        shadowSunCycleMode: "dayOnly",
        shadowSunDayCycleSpeedMultiplier: 64,
        shadowSunStepsPerDay: 288,
        staticLightCycleOverride: "on",
      },
    } as any);
    expect(getUserSettings().debug.shadowSunDayCycleEnabled).toBe(true);
    expect(getUserSettings().debug.shadowSunCycleMode).toBe("dayOnly");
    expect(getUserSettings().debug.shadowSunDayCycleSpeedMultiplier).toBe(64);
    expect(getUserSettings().debug.shadowSunStepsPerDay).toBe(288);
    expect(getUserSettings().debug.staticLightCycleOverride).toBe("on");

    updateUserSettings({
      debug: {
        shadowSunCycleMode: "__bad__" as any,
        shadowSunDayCycleSpeedMultiplier: 3 as any,
        shadowSunStepsPerDay: 12 as any,
        staticLightCycleOverride: "__bad__" as any,
      },
    } as any);
    expect(getUserSettings().debug.shadowSunCycleMode).toBe("full24h");
    expect(getUserSettings().debug.shadowSunDayCycleSpeedMultiplier).toBe(1);
    expect(getUserSettings().debug.shadowSunStepsPerDay).toBe(96);
    expect(getUserSettings().debug.staticLightCycleOverride).toBe("automatic");
  });
});
