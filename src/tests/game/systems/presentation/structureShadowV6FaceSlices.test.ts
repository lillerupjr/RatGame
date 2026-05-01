import { describe, expect, it } from "vitest";
import {
  buildStructureV6SliceAxis,
  buildStructureV6FaceSlices,
  clampStructureV6SliceCount,
  clampStructureV6StructureIndex,
  normalizeStructureV6SemanticBucket,
  resolveStructureV6SliceDirection,
  resolveStructureV6SliceIndex,
  resolveStructureV6SelectedCandidateIndex,
} from "../../../../game/systems/presentation/structureShadowV6FaceSlices";

describe("structureShadowV6FaceSlices", () => {
  it("uses fixed isometric slice directions", () => {
    const eastWest = resolveStructureV6SliceDirection("EAST_WEST");
    const southNorth = resolveStructureV6SliceDirection("SOUTH_NORTH");
    expect(eastWest.x).toBeCloseTo(0.8944, 3);
    expect(eastWest.y).toBeCloseTo(-0.4472, 3);
    expect(southNorth.x).toBeCloseTo(0.8944, 3);
    expect(southNorth.y).toBeCloseTo(0.4472, 3);
  });

  it("builds projection-based slices and resolves pixel slice indices", () => {
    const axis = buildStructureV6SliceAxis(100, 80, "EAST_WEST");
    const slices = buildStructureV6FaceSlices(axis, 4);
    expect(slices).toHaveLength(4);
    expect(slices[0].tStart).toBeCloseTo(axis.minT, 6);
    expect(slices[3].tEnd).toBeCloseTo(axis.maxT, 6);
    for (let i = 1; i < slices.length; i++) {
      expect(slices[i - 1].tEnd).toBeCloseTo(slices[i].tStart, 6);
    }

    const idxBottom = resolveStructureV6SliceIndex(50.5, 79.5, axis, slices.length);
    const idxTop = resolveStructureV6SliceIndex(50.5, 0.5, axis, slices.length);
    expect(idxBottom).toBeLessThanOrEqual(idxTop);
  });

  it("normalizes semantic buckets and numeric selectors", () => {
    expect(normalizeStructureV6SemanticBucket("TOP")).toBe("TOP");
    expect(normalizeStructureV6SemanticBucket("bad")).toBe("EAST_WEST");
    expect(clampStructureV6SliceCount(0)).toBe(1);
    expect(clampStructureV6SliceCount(64)).toBe(32);
    expect(clampStructureV6StructureIndex(-9)).toBe(0);
    expect(clampStructureV6StructureIndex(999)).toBe(127);
  });

  it("resolves selected structure index with stable wrapping", () => {
    expect(resolveStructureV6SelectedCandidateIndex(0, 2)).toBe(-1);
    expect(resolveStructureV6SelectedCandidateIndex(5, 2)).toBe(2);
    expect(resolveStructureV6SelectedCandidateIndex(5, 7)).toBe(2);
    expect(resolveStructureV6SelectedCandidateIndex(5, -1)).toBe(4);
  });
});
