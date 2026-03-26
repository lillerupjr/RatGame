import { afterEach, describe, expect, it } from "vitest";
import {
  buildUnifiedWorldShadowMap,
  clearSweepShadowMap,
  computeSweepShadowMap,
  type TileHeightGrid,
} from "../../../game/map/sweepShadow";
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

  it("returns an empty shadow map at night", () => {
    const sun = getShadowSunV1Model(20);
    const grid: TileHeightGrid = {
      originTx: 0,
      originTy: 0,
      width: 2,
      height: 2,
      version: "night",
      heights: new Float32Array([
        0, 4,
        2, 6,
      ]),
    };

    const map = computeSweepShadowMap(grid, sun, "night-test");

    expect(map).toBeTruthy();
    expect(Array.from(map!.data)).toEqual([0, 0, 0, 0]);
  });

  it("builds a unified world shadow map with ambient darkness as the floor", () => {
    const grid: TileHeightGrid = {
      originTx: 0,
      originTy: 0,
      width: 2,
      height: 2,
      version: "ambient-floor",
      heights: new Float32Array([
        0, 0,
        0, 0,
      ]),
    };
    const castShadowMap = {
      originTx: 0,
      originTy: 0,
      width: 2,
      height: 2,
      data: new Float32Array([
        0.1, 0.8,
        0.0, 0.3,
      ]),
    };

    const unified = buildUnifiedWorldShadowMap(grid, castShadowMap, 0.25);

    expect(unified).toBeTruthy();
    expect(unified!.data[0]).toBeCloseTo(0.25, 6);
    expect(unified!.data[1]).toBeCloseTo(0.8, 6);
    expect(unified!.data[2]).toBeCloseTo(0.25, 6);
    expect(unified!.data[3]).toBeCloseTo(0.3, 6);
  });
});
