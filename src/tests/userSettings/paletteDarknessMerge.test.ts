import { describe, expect, it } from "vitest";
import { getUserSettings, updateUserSettings } from "../../userSettings";

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
});
