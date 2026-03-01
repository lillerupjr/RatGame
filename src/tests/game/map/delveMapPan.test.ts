import { describe, expect, test } from "vitest";
import { clampPan, computePanBounds, hasDragExceededThreshold } from "../../../game/map/delveMapPan";

describe("delveMapPan", () => {
  test("computes pan bounds for larger content", () => {
    const bounds = computePanBounds(1600, 900, 800, 520);
    expect(bounds).toEqual({
      minX: -800,
      maxX: 0,
      minY: -380,
      maxY: 0,
    });
  });

  test("bounds clamp to zero when content fits viewport", () => {
    const bounds = computePanBounds(600, 300, 800, 520);
    expect(bounds).toEqual({
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });

  test("clamps pan values into bounds", () => {
    const bounds = computePanBounds(1600, 900, 800, 520);
    expect(clampPan({ x: -900, y: 50 }, bounds)).toEqual({ x: -800, y: 0 });
    expect(clampPan({ x: -400, y: -200 }, bounds)).toEqual({ x: -400, y: -200 });
  });

  test("drag threshold is deterministic", () => {
    expect(hasDragExceededThreshold(10, 10, 12, 13, 6)).toBe(false);
    expect(hasDragExceededThreshold(10, 10, 17, 15, 6)).toBe(true);
  });
});
