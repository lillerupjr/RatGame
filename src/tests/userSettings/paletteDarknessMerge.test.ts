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

  it("persists static relight poc render toggle", () => {
    updateUserSettings({
      render: {
        staticRelightPocEnabled: true,
      },
    } as any);
    expect(getUserSettings().render.staticRelightPocEnabled).toBe(true);

    updateUserSettings({
      render: {
        staticRelightPocEnabled: false,
      },
    } as any);
    expect(getUserSettings().render.staticRelightPocEnabled).toBe(false);
  });
});
