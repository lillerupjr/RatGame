import { type LoadedImg } from "../../../../engine/render/sprites/renderSprites";
import { type StaticRelightBakeDependencyTracker } from "./staticRelightTypes";

export type StaticRelightBakeAssetState = "READY" | "PENDING" | "FAILED";

export function createStaticRelightBakeDependencyTracker(): StaticRelightBakeDependencyTracker {
  return {
    required: new Set<string>(),
    ready: new Set<string>(),
    pending: new Set<string>(),
    failed: new Set<string>(),
    pendingSample: [],
  };
}

export function noteStaticRelightDependencyState(
  tracker: StaticRelightBakeDependencyTracker,
  key: string,
  state: StaticRelightBakeAssetState,
): void {
  tracker.required.add(key);
  if (state === "READY") {
    tracker.ready.add(key);
    tracker.pending.delete(key);
    tracker.failed.delete(key);
    return;
  }
  if (state === "PENDING") {
    tracker.pending.add(key);
    tracker.ready.delete(key);
    if (tracker.pendingSample.length < 20 && !tracker.pendingSample.includes(key)) {
      tracker.pendingSample.push(key);
    }
    return;
  }
  tracker.failed.add(key);
  tracker.ready.delete(key);
  tracker.pending.delete(key);
}

export function classifyStaticRelightBakeAsset(
  rec: LoadedImg | null | undefined,
): StaticRelightBakeAssetState {
  if (!rec) return "FAILED";
  if (rec.ready && rec.img && rec.img.naturalWidth > 0 && rec.img.naturalHeight > 0) return "READY";
  if (rec.failed || rec.unsupported) return "FAILED";
  if (rec.ready) return "FAILED";
  return "PENDING";
}
