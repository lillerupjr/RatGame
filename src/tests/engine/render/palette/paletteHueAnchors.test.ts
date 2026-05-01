import { describe, expect, it } from "vitest";
import { hexToRgb, hueDistanceDegrees, rgbToHsv } from "../../../../engine/render/palette/colorMath";
import { getPaletteById, getPaletteHsvAnchors, getPaletteHueAnchors } from "../../../../engine/render/palette/palettes";

describe("palette hue anchors", () => {
  it("derives one anchor per palette color in palette order", () => {
    const palette = getPaletteById("divination");
    const anchors = getPaletteHueAnchors("divination");
    const expected = palette.colors.map((hex) => rgbToHsv(hexToRgb(hex)).h);

    expect(anchors.length).toBe(palette.colors.length);
    expect(anchors).toEqual(expected);
  });

  it("caches anchors by resolved palette id", () => {
    const first = getPaletteHueAnchors("divination");
    const second = getPaletteHueAnchors("divination");
    expect(second).toBe(first);

    const fallback = getPaletteHueAnchors("__unknown_palette__");
    const db32 = getPaletteHueAnchors("db32");
    expect(fallback).toBe(db32);
  });

  it("derives HSV anchors in palette order for S/V blending", () => {
    const palette = getPaletteById("divination");
    const hsvAnchors = getPaletteHsvAnchors("divination");
    const expected = palette.colors.map((hex) => rgbToHsv(hexToRgb(hex)));

    expect(hsvAnchors.length).toBe(expected.length);
    for (let i = 0; i < hsvAnchors.length; i++) {
      expect(hsvAnchors[i].h).toBe(expected[i].h);
      expect(Math.abs(hsvAnchors[i].s - expected[i].s)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(hsvAnchors[i].v - expected[i].v)).toBeLessThanOrEqual(1e-9);
    }
  });
});

describe("hue distance", () => {
  it("uses circular distance across wraparound", () => {
    expect(hueDistanceDegrees(359, 1)).toBe(2);
    expect(hueDistanceDegrees(1, 359)).toBe(2);
  });
});
