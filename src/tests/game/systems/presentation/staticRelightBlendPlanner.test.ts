import { describe, expect, it } from "vitest";
import {
  clamp01,
  hasNearbyStaticRelightTileLight,
  planStaticRelightBlendForPiece,
} from "../../../../game/systems/presentation/staticRelight/staticRelightBlendPlanner";
import { type StaticRelightFrameContext } from "../../../../game/systems/presentation/staticRelight/staticRelightTypes";

function makeFrame(overrides?: Partial<StaticRelightFrameContext>): StaticRelightFrameContext {
  return {
    baseDarknessBucket: 75,
    targetDarknessBucket: 50,
    strengthScale: 1,
    lights: [
      {
        id: "light-1",
        tileX: 10,
        tileY: 10,
        centerX: 100,
        centerY: 100,
        radiusPx: 120,
        intensity: 1,
      },
    ],
    maxLights: 2,
    tileInfluenceRadius: 6,
    minBlendAlpha: 0.04,
    ...overrides,
  };
}

describe("staticRelightBlendPlanner", () => {
  it("clamp01 clamps out-of-range and non-finite values", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(0.35)).toBe(0.35);
  });

  it("plans relight blend for in-range light candidates", () => {
    const plan = planStaticRelightBlendForPiece(
      makeFrame(),
      10,
      10,
      80,
      80,
      64,
      64,
    );

    expect(plan).toBeTruthy();
    expect(plan!.targetDarknessBucket).toBe(50);
    expect(plan!.blendAlpha).toBe(1);
    expect(plan!.masks.length).toBeGreaterThan(0);
  });

  it("returns null when strength is below minimum blend alpha", () => {
    const plan = planStaticRelightBlendForPiece(
      makeFrame({ strengthScale: 0.02, minBlendAlpha: 0.04 }),
      10,
      10,
      80,
      80,
      64,
      64,
    );

    expect(plan).toBeNull();
  });

  it("detects nearby tile light by configured tile radius", () => {
    const frame = makeFrame();
    expect(hasNearbyStaticRelightTileLight(frame, 11, 10)).toBe(true);
    expect(hasNearbyStaticRelightTileLight(frame, 40, 40)).toBe(false);
  });
});
