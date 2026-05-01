import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePaletteRemapWeightPercent } from "../../../debugSettings";
import { updateUserSettings } from "../../../userSettings";
import { hardResetAllSettings } from "../../../settings/settingsStore";
import { getActiveMapSkinPaletteEntry, setActiveMapSkinId } from "../../../game/content/mapSkins";
import {
  resolveActivePaletteId,
  resolveActivePaletteSwapWeightPercents,
} from "../../../game/render/activePalette";

describe("activePalette", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    hardResetAllSettings();
    setActiveMapSkinId(undefined);
  });

  it("uses the selected authored palette entry when no explicit override is enabled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    setActiveMapSkinId("avenue");

    updateUserSettings({
      debug: {
        paletteSWeightPercent: 0,
        paletteDarknessPercent: 0,
      },
    });

    const selectedEntry = getActiveMapSkinPaletteEntry();

    expect(resolveActivePaletteId()).toBe(selectedEntry.paletteId);
    expect(resolveActivePaletteSwapWeightPercents()).toEqual({
      sWeightPercent: normalizePaletteRemapWeightPercent(selectedEntry.saturationWeight * 100),
      darknessPercent: normalizePaletteRemapWeightPercent(selectedEntry.darkness * 100),
    });
  });

  it("keeps explicit palette override precedence over authored random selection", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    setActiveMapSkinId("avenue");

    updateUserSettings({
      render: {
        paletteSwapEnabled: true,
        paletteId: "cyberpunk",
      },
      debug: {
        paletteSWeightPercent: 25,
        paletteDarknessPercent: 75,
      },
    });

    expect(resolveActivePaletteId()).toBe("cyberpunk");
    expect(resolveActivePaletteSwapWeightPercents()).toEqual({
      sWeightPercent: 25,
      darknessPercent: 75,
    });
  });
});
