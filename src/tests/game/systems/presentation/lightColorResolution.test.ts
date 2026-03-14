import { describe, expect, it } from "vitest";
import { hexToRgb, rgbToHsv } from "../../../../engine/render/palette/colorMath";
import { getPaletteHsvAnchors } from "../../../../engine/render/palette/palettes";
import { pickNearestPaletteHsvAnchor } from "../../../../engine/render/palette/paletteSwap";
import {
  DEFAULT_STANDARD_LIGHT_COLOR,
  resolveLightColorAndIntensity,
  resolvePaletteLightTint,
} from "../../../../game/systems/presentation/lightColorResolution";

describe("lightColorResolution", () => {
  it("palette tint keeps source brightness while hue-locking to nearest palette anchor", () => {
    const authoredColor = "#804020";
    const paletteId = "db32";
    const sourceHsv = rgbToHsv(hexToRgb(authoredColor));
    const nearestPalette = pickNearestPaletteHsvAnchor(sourceHsv.h, getPaletteHsvAnchors(paletteId));
    const resolvedColor = resolvePaletteLightTint({ authoredColor, paletteId, saturationWeight: 1 });
    const resolvedHsv = rgbToHsv(hexToRgb(resolvedColor));

    expect(resolvedHsv.h).toBeCloseTo(nearestPalette.h, 0);
    expect(resolvedHsv.v).toBeCloseTo(sourceHsv.v, 2);
    expect(resolvedHsv.s).toBeCloseTo(nearestPalette.s, 2);
  });

  it("palette tint honors saturationWeight extremes", () => {
    const authoredColor = "#4FA8FF";
    const paletteId = "db32";
    const sourceHsv = rgbToHsv(hexToRgb(authoredColor));
    const nearestPalette = pickNearestPaletteHsvAnchor(sourceHsv.h, getPaletteHsvAnchors(paletteId));

    const resolvedAtZero = rgbToHsv(hexToRgb(resolvePaletteLightTint({
      authoredColor,
      paletteId,
      saturationWeight: 0,
    })));
    const resolvedAtOne = rgbToHsv(hexToRgb(resolvePaletteLightTint({
      authoredColor,
      paletteId,
      saturationWeight: 1,
    })));

    expect(resolvedAtZero.s).toBeCloseTo(sourceHsv.s, 2);
    expect(resolvedAtOne.s).toBeCloseTo(nearestPalette.s, 2);
  });

  it("off mode skips light, standard ignores authored color, and strength scales intensity", () => {
    const off = resolveLightColorAndIntensity({
      colorMode: "off",
      strength: "high",
      authoredColor: "#00FF00",
      baseIntensity: 1,
      paletteId: "db32",
      saturationWeight: 1,
    });
    expect(off.skip).toBe(true);

    const standard = resolveLightColorAndIntensity({
      colorMode: "standard",
      strength: "medium",
      authoredColor: "#00FF00",
      baseIntensity: 0.9,
      paletteId: "db32",
      saturationWeight: 1,
    });
    expect(standard.color).toBe(DEFAULT_STANDARD_LIGHT_COLOR);
    expect(standard.intensity).toBeCloseTo(0.9);

    const high = resolveLightColorAndIntensity({
      colorMode: "standard",
      strength: "high",
      authoredColor: "#00FF00",
      baseIntensity: 0.8,
      paletteId: "db32",
      saturationWeight: 1,
    });
    expect(high.intensity).toBeCloseTo(1);
  });
});
