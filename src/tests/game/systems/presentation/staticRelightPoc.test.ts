import { describe, expect, it } from "vitest";
import {
  nextLighterBucket,
  planPieceLocalRelight,
  type StaticRelightLightCandidate,
} from "../../../../game/systems/presentation/staticRelightPoc";

describe("staticRelightPoc", () => {
  it("returns null when no nearby lights influence the piece", () => {
    const lights: StaticRelightLightCandidate[] = [
      {
        id: "far_light",
        tileX: 20,
        tileY: 20,
        centerX: 800,
        centerY: 800,
        radiusPx: 120,
        intensity: 1,
      },
    ];

    const plan = planPieceLocalRelight({
      baseDarknessBucket: 75,
      pieceTileX: 0,
      pieceTileY: 0,
      pieceScreenRect: { x: 100, y: 100, width: 128, height: 64 },
      lights,
    });

    expect(plan).toBeNull();
  });

  it("plans a lighter variant blend when a nearby light influences the piece", () => {
    const lights: StaticRelightLightCandidate[] = [
      {
        id: "lamp_1",
        tileX: 5,
        tileY: 8,
        centerX: 220,
        centerY: 160,
        radiusPx: 140,
        intensity: 0.9,
      },
    ];

    const plan = planPieceLocalRelight({
      baseDarknessBucket: 75,
      pieceTileX: 5,
      pieceTileY: 8,
      pieceScreenRect: { x: 180, y: 130, width: 128, height: 64 },
      lights,
    });

    expect(plan).not.toBeNull();
    expect(plan?.targetDarknessBucket).toBe(50);
    expect(plan?.blendAlpha).toBe(1);
    expect((plan?.masks.length ?? 0) > 0).toBe(true);
    expect(plan?.masks[0].alpha).toBeCloseTo(0.9);
  });

  it("returns piece-local mask coordinates and bounds", () => {
    const lights: StaticRelightLightCandidate[] = [
      {
        id: "lamp_local",
        tileX: 10,
        tileY: 10,
        centerX: 320,
        centerY: 220,
        radiusPx: 120,
        intensity: 1,
      },
    ];

    const plan = planPieceLocalRelight({
      baseDarknessBucket: 50,
      pieceTileX: 10,
      pieceTileY: 10,
      pieceScreenRect: { x: 256, y: 192, width: 128, height: 64 },
      lights,
    });

    expect(plan).not.toBeNull();
    expect(plan?.localBounds).toEqual({ x: 0, y: 0, width: 128, height: 64 });
    expect(plan?.masks[0].centerX).toBeCloseTo(64);
    expect(plan?.masks[0].centerY).toBeCloseTo(28);
    expect(plan?.masks[0].centerX).toBeLessThan(128);
    expect(plan?.masks[0].centerY).toBeLessThan(64);
  });

  it("maps next lighter darkness bucket in single 25% steps", () => {
    expect(nextLighterBucket(100)).toBe(75);
    expect(nextLighterBucket(75)).toBe(50);
    expect(nextLighterBucket(50)).toBe(25);
    expect(nextLighterBucket(25)).toBe(0);
    expect(nextLighterBucket(0)).toBeNull();
  });

  it("uses strength-neutral blend alpha for pieces intersecting the same light", () => {
    const lights: StaticRelightLightCandidate[] = [
      {
        id: "lamp_shared",
        tileX: 10,
        tileY: 10,
        centerX: 256,
        centerY: 256,
        radiusPx: 180,
        intensity: 0.8,
      },
    ];

    const planA = planPieceLocalRelight({
      baseDarknessBucket: 75,
      pieceTileX: 10,
      pieceTileY: 10,
      pieceScreenRect: { x: 160, y: 210, width: 128, height: 64 },
      lights,
    });
    const planB = planPieceLocalRelight({
      baseDarknessBucket: 75,
      pieceTileX: 11,
      pieceTileY: 10,
      pieceScreenRect: { x: 260, y: 210, width: 128, height: 64 },
      lights,
    });

    expect(planA).not.toBeNull();
    expect(planB).not.toBeNull();
    expect(planA?.blendAlpha).toBe(1);
    expect(planB?.blendAlpha).toBe(1);
  });

  it("relights when light overlaps piece bounds even if piece center is farther away", () => {
    const lights: StaticRelightLightCandidate[] = [
      {
        id: "edge_overlap",
        tileX: 4,
        tileY: 4,
        centerX: 100,
        centerY: 100,
        radiusPx: 30,
        intensity: 1,
      },
    ];

    const plan = planPieceLocalRelight({
      baseDarknessBucket: 75,
      pieceTileX: 4,
      pieceTileY: 4,
      pieceScreenRect: { x: 128, y: 80, width: 64, height: 64 },
      lights,
    });

    expect(plan).not.toBeNull();
    expect(plan?.blendAlpha).toBe(1);
    expect((plan?.masks.length ?? 0) > 0).toBe(true);
  });
});
