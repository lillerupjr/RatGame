import { describe, expect, it } from "vitest";
import {
  classifyStaticRelightBakeAsset,
  createStaticRelightBakeDependencyTracker,
  noteStaticRelightDependencyState,
} from "../../../../game/systems/presentation/staticRelight/staticRelightBakeDependencies";

describe("staticRelightBakeDependencies", () => {
  it("tracks ready/pending/failed dependency state transitions", () => {
    const tracker = createStaticRelightBakeDependencyTracker();

    noteStaticRelightDependencyState(tracker, "k1", "PENDING");
    noteStaticRelightDependencyState(tracker, "k2", "FAILED");
    noteStaticRelightDependencyState(tracker, "k1", "READY");

    expect(tracker.required.has("k1")).toBe(true);
    expect(tracker.required.has("k2")).toBe(true);
    expect(tracker.ready.has("k1")).toBe(true);
    expect(tracker.pending.has("k1")).toBe(false);
    expect(tracker.failed.has("k2")).toBe(true);
    expect(tracker.pendingSample).toContain("k1");
  });

  it("classifies loaded image asset states", () => {
    expect(classifyStaticRelightBakeAsset(null)).toBe("FAILED");
    expect(classifyStaticRelightBakeAsset({
      ready: false,
      failed: false,
      unsupported: false,
    } as any)).toBe("PENDING");
    expect(classifyStaticRelightBakeAsset({
      ready: true,
      failed: false,
      unsupported: false,
      img: { naturalWidth: 0, naturalHeight: 0 },
    } as any)).toBe("FAILED");
    expect(classifyStaticRelightBakeAsset({
      ready: true,
      failed: false,
      unsupported: false,
      img: { naturalWidth: 64, naturalHeight: 64 },
    } as any)).toBe("READY");
  });
});
