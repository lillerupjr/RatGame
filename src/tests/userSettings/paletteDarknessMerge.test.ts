import { describe, expect, it } from "vitest";
import { getUserSettings, updateUserSettings } from "../../userSettings";
import { getFirstPaletteInGroup, getPalettesByGroup } from "../../engine/render/palette/palettes";

describe("userSettings palette darkness merge", () => {
  it("drops legacy paletteVWeightPercent", () => {
    updateUserSettings({
      debug: {
        paletteDarknessPercent: 0,
      },
    });

    updateUserSettings({
      debug: {
        paletteVWeightPercent: 100,
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

  it("normalizes static relight debug controls to allowed buckets", () => {
    updateUserSettings({
      debug: {
        staticRelightStrengthPercent: 63 as any,
        staticRelightTargetDarknessPercent: 61 as any,
      },
    });

    expect(getUserSettings().debug.staticRelightStrengthPercent).toBe(75);
    expect(getUserSettings().debug.staticRelightTargetDarknessPercent).toBe(50);
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

  it("persists static relight render toggle", () => {
    updateUserSettings({
      render: {
        staticRelightEnabled: true,
      },
    } as any);
    expect(getUserSettings().render.staticRelightEnabled).toBe(true);

    updateUserSettings({
      render: {
        staticRelightEnabled: false,
      },
    } as any);
    expect(getUserSettings().render.staticRelightEnabled).toBe(false);
  });

  it("persists structure triangle geometry render toggle", () => {
    updateUserSettings({
      render: {
        structureTriangleGeometryEnabled: true,
      },
    } as any);
    expect(getUserSettings().render.structureTriangleGeometryEnabled).toBe(true);

    updateUserSettings({
      render: {
        structureTriangleGeometryEnabled: false,
      },
    } as any);
    expect(getUserSettings().render.structureTriangleGeometryEnabled).toBe(false);
  });

  it("migrates legacy poc toggle keys to production render toggles", () => {
    updateUserSettings({
      render: {
        staticRelightPocEnabled: true,
        structureTriangleGeometryPocEnabled: true,
      } as any,
    } as any);
    expect(getUserSettings().render.staticRelightEnabled).toBe(true);
    expect(getUserSettings().render.structureTriangleGeometryEnabled).toBe(true);
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
});
