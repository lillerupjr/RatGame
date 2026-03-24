import { afterEach, describe, expect, it } from "vitest";
import { clearSweepShadowMap, computeSweepShadowMap, type TileHeightGrid } from "../../../game/map/sweepShadow";
import { getShadowSunV1Model } from "../../../shadowSunV1";

describe("sweepShadow", () => {
  afterEach(() => {
    clearSweepShadowMap();
  });

  it("reuses cached results for the same height-grid version and recomputes when the version changes", () => {
    const sun = getShadowSunV1Model(13);
    const v1Grid: TileHeightGrid = {
      originTx: 0,
      originTy: 0,
      width: 3,
      height: 3,
      version: "v1",
      heights: new Float32Array([
        0, 0, 0,
        0, 4, 0,
        0, 0, 0,
      ]),
    };

    const first = computeSweepShadowMap(v1Grid, sun, "cache-test");
    const second = computeSweepShadowMap(v1Grid, sun, "cache-test");
    expect(first).toBeTruthy();
    expect(second).toBe(first);

    const v2Grid: TileHeightGrid = {
      ...v1Grid,
      version: "v2",
      heights: new Float32Array([
        0, 0, 0,
        0, 8, 0,
        0, 0, 0,
      ]),
    };
    const third = computeSweepShadowMap(v2Grid, sun, "cache-test");
    expect(third).toBeTruthy();
    expect(third).not.toBe(first);
  });
});
