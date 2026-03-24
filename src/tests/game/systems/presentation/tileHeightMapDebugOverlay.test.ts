import { describe, expect, it } from "vitest";
import { buildTileHeightMapDebugOverlayKey } from "../../../../game/systems/presentation/debug/tileHeightMapDebugOverlay";

describe("tileHeightMapDebugOverlay", () => {
  it("keys the baked overlay by map id, height-grid version, and elevation scale", () => {
    const grid = {
      originTx: 0,
      originTy: 0,
      width: 2,
      height: 2,
      version: "v1",
      heights: new Float32Array([0, 1, 2, 3]),
    };
    expect(buildTileHeightMapDebugOverlayKey("mapA", grid, 16))
      .toBe(buildTileHeightMapDebugOverlayKey("mapA", grid, 16));
    expect(buildTileHeightMapDebugOverlayKey("mapA", grid, 16))
      .not.toBe(buildTileHeightMapDebugOverlayKey("mapB", grid, 16));
    expect(buildTileHeightMapDebugOverlayKey("mapA", { ...grid, version: "v2" }, 16))
      .not.toBe(buildTileHeightMapDebugOverlayKey("mapA", grid, 16));
    expect(buildTileHeightMapDebugOverlayKey("mapA", grid, 24))
      .not.toBe(buildTileHeightMapDebugOverlayKey("mapA", grid, 16));
  });
});
