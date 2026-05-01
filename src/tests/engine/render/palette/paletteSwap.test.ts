import { describe, expect, it } from "vitest";
import { hsvToRgb, hueDistanceDegrees, rgbToHsv } from "../../../../engine/render/palette/colorMath";
import { pickNearestHueAnchor, remapRgbaByHueLockInPlace } from "../../../../engine/render/palette/paletteSwap";

describe("pickNearestHueAnchor", () => {
  it("uses first palette-order anchor on exact circular tie", () => {
    const anchors = [350, 10];
    expect(pickNearestHueAnchor(0, anchors)).toBe(350);
  });

  it("uses circular hue distance for selection", () => {
    const anchors = [20, 200];
    expect(pickNearestHueAnchor(359, anchors)).toBe(20);
  });
});

describe("remapRgbaByHueLockInPlace", () => {
  it("preserves saturation and value while snapping hue to nearest palette anchor", () => {
    const srcRgb = hsvToRgb({ h: 25, s: 0.72, v: 0.61 });
    const before = rgbToHsv(srcRgb);

    const data = new Uint8ClampedArray([srcRgb.r, srcRgb.g, srcRgb.b, 255]);
    remapRgbaByHueLockInPlace(data, [{ h: 205, s: 0.18, v: 0.2 }]);

    const after = rgbToHsv({ r: data[0], g: data[1], b: data[2] });
    expect(hueDistanceDegrees(after.h, 205)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(after.s - before.s)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(after.v - before.v)).toBeLessThanOrEqual(0.02);
  });

  it("preserves alpha and leaves fully transparent pixels unchanged", () => {
    const data = new Uint8ClampedArray([
      12, 34, 56, 0, // transparent pixel
      200, 120, 80, 17, // visible pixel with partial alpha
    ]);

    remapRgbaByHueLockInPlace(data, [{ h: 120, s: 0.8, v: 0.8 }]);

    expect(Array.from(data.slice(0, 4))).toEqual([12, 34, 56, 0]);
    expect(data[7]).toBe(17);
  });

  it("applies hue-lock even for low-saturation pixels (no neutral-lane exemption)", () => {
    const srcRgb = hsvToRgb({ h: 20, s: 0.05, v: 0.7 });
    const before = rgbToHsv(srcRgb);

    const data = new Uint8ClampedArray([srcRgb.r, srcRgb.g, srcRgb.b, 255]);
    remapRgbaByHueLockInPlace(data, [{ h: 200, s: 0.4, v: 0.5 }]);

    const after = rgbToHsv({ r: data[0], g: data[1], b: data[2] });
    expect(hueDistanceDegrees(after.h, 200)).toBeLessThanOrEqual(8);
    expect(Math.abs(after.s - before.s)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(after.v - before.v)).toBeLessThanOrEqual(0.02);
  });

  it("blends saturation and applies non-linear darkness as a final value multiplier", () => {
    const srcRgb = hsvToRgb({ h: 18, s: 0.2, v: 0.9 });
    const before = rgbToHsv(srcRgb);

    const data = new Uint8ClampedArray([srcRgb.r, srcRgb.g, srcRgb.b, 255]);
    remapRgbaByHueLockInPlace(
      data,
      [{ h: 220, s: 1, v: 0.2 }],
      { sWeight: 0.5, darkness: 0.25 },
    );

    const after = rgbToHsv({ r: data[0], g: data[1], b: data[2] });
    const expectedS = before.s * 0.5 + 1 * 0.5;
    const expectedBrightness = 1 - Math.pow(0.25, 1.8);
    const expectedV = before.v * expectedBrightness;

    expect(hueDistanceDegrees(after.h, 220)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(after.s - expectedS)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(after.v - expectedV)).toBeLessThanOrEqual(0.03);
  });
});
