import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTHORED_DELVE_PALETTE_ENTRIES,
  type AuthoredDelvePaletteEntry,
} from "../../../game/content/delvePaletteRegistry";
import {
  getActiveMapSkinPaletteEntry,
  getActiveMapSkinPaletteId,
  pickRandomEnabledDelvePaletteEntry,
  setActiveMapSkinId,
} from "../../../game/content/mapSkins";

describe("mapSkins central palette registry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActiveMapSkinId(undefined);
  });

  it("filters disabled entries from the random delve picker", () => {
    const entries: readonly AuthoredDelvePaletteEntry[] = [
      {
        paletteId: "db32",
        saturationWeight: 0.25,
        darkness: 0.25,
        enabledForRandomDelvePicker: false,
      },
      {
        paletteId: "cyberpunk",
        saturationWeight: 0.75,
        darkness: 0.5,
        enabledForRandomDelvePicker: true,
      },
    ];

    const picked = pickRandomEnabledDelvePaletteEntry(entries, 0);

    expect(picked).toEqual(entries[1]);
  });

  it("preserves duplicate palette ids as distinct authored variants", () => {
    const entries: readonly AuthoredDelvePaletteEntry[] = [
      {
        paletteId: "night_16",
        saturationWeight: 0.25,
        darkness: 0.25,
        enabledForRandomDelvePicker: true,
      },
      {
        paletteId: "night_16",
        saturationWeight: 1,
        darkness: 0.75,
        enabledForRandomDelvePicker: true,
      },
    ];

    const first = pickRandomEnabledDelvePaletteEntry(entries, 0);
    const second = pickRandomEnabledDelvePaletteEntry(entries, 0.999);

    expect(first?.paletteId).toBe("night_16");
    expect(second?.paletteId).toBe("night_16");
    expect(first?.saturationWeight).toBe(0.25);
    expect(second?.saturationWeight).toBe(1);
    expect(first).not.toEqual(second);
  });

  it("keeps fixed-skin palette ids out of the random picker flow", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.999);

    setActiveMapSkinId("building1");

    expect(getActiveMapSkinPaletteId()).toBe("db32");
    expect(getActiveMapSkinPaletteEntry()).toMatchObject({
      paletteId: "db32",
      saturationWeight: 0.75,
      darkness: 0.5,
      enabledForRandomDelvePicker: false,
    });
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it("includes the test-group palettes in the authored registry", () => {
    const paletteIds = new Set(AUTHORED_DELVE_PALETTE_ENTRIES.map((entry) => entry.paletteId));

    expect(paletteIds.has("midnight_ablaze")).toBe(true);
    expect(paletteIds.has("blessing")).toBe(true);
    expect(paletteIds.has("hollow")).toBe(true);
    expect(paletteIds.has("berry_nebula")).toBe(true);
    expect(paletteIds.has("cyclope6")).toBe(true);
    expect(paletteIds.has("bloodmoon21")).toBe(true);
    expect(paletteIds.has("blk_aqu4")).toBe(true);
    expect(paletteIds.has("dustbyte")).toBe(true);
    expect(paletteIds.has("hydrangea_11")).toBe(true);
    expect(paletteIds.has("fiery_plague_gb")).toBe(true);
    expect(paletteIds.has("leopolds_dreams")).toBe(true);
    expect(paletteIds.has("look_of_horror")).toBe(true);
    expect(paletteIds.has("aquaverse")).toBe(true);
    expect(paletteIds.has("sunraze")).toBe(true);
  });
});
