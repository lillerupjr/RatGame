import { describe, expect, it } from "vitest";
import { getStructureSlices } from "../../../../game/structures/getStructureSlices";

describe("getStructureSlices (monolithic debug authority)", () => {
  it("keeps anchor inside the first emitted slice", () => {
    const slices = getStructureSlices({
      bounds: { width: 420, height: 128 },
      anchor: { x: 211, y: 100 },
    });

    expect(slices.length).toBeGreaterThan(0);
    const anchorSlice = slices.find((slice) => 211 >= slice.x && 211 < (slice.x + slice.width));
    expect(anchorSlice).toBeTruthy();
  });

  it("returns deterministic anchor-outward order", () => {
    const first = getStructureSlices({
      bounds: { width: 420, height: 128 },
      anchor: { x: 211, y: 100 },
    });
    const second = getStructureSlices({
      bounds: { width: 420, height: 128 },
      anchor: { x: 211, y: 100 },
    });

    expect(second).toEqual(first);
  });

  it("expands outer edge slices to full 64px while keeping interior seams", () => {
    const slices = getStructureSlices({
      bounds: { width: 420, height: 128 },
      anchor: { x: 211, y: 100 },
    });

    const widths = slices.map((slice) => slice.width);
    expect(Math.min(...widths)).toBe(64);

    const leftMost = slices.reduce((best, slice) => (slice.x < best.x ? slice : best), slices[0]);
    const rightMost = slices.reduce((best, slice) => (slice.x > best.x ? slice : best), slices[0]);

    expect(leftMost.width).toBe(64);
    expect(rightMost.width).toBe(64);
  });
});
