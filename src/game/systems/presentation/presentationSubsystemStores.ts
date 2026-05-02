// @system   atlas/render-cache
// @owns     instantiate shared presentation cache and atlas stores and register their metrics
// @doc      docs/canonical/atlas_render_cache_system.md
// @agents   no cache policies, atlas packing, or render command ordering — see cache owners, atlasPageBuilder.ts, and presentation_rendering_pipeline.md

import { RuntimeStructureTriangleCacheStore } from "../../structures/monolithicStructureGeometry";
import { CanvasGroundChunkCacheStore } from "./canvasGroundChunkCache";
import { registerCacheMetricSource } from "./cacheMetricsRegistry";
import { DynamicAtlasStore } from "./dynamicAtlasStore";
import { SharedWorldAtlasStore } from "./sharedWorldAtlasStore";
import { StaticAtlasStore } from "./staticAtlasStore";
import { StructureMergedSliceCacheStore } from "./structures/structureMergedSliceCache";

export const monolithicStructureGeometryCacheStore = new RuntimeStructureTriangleCacheStore();
export const canvasGroundChunkCacheStore = new CanvasGroundChunkCacheStore();
export const staticAtlasStore = new StaticAtlasStore();
export const dynamicAtlasStore = new DynamicAtlasStore();
export const sharedWorldAtlasStore = new SharedWorldAtlasStore();
export const structureMergedSliceCacheStore = new StructureMergedSliceCacheStore();

registerCacheMetricSource({
  name: "groundChunks",
  budgetBytes: 96 * 1024 * 1024,
  sample: () => canvasGroundChunkCacheStore.getDebugCacheMetrics(),
});

registerCacheMetricSource({
  name: "structureTriangleCache",
  budgetEntries: 2048,
  sample: () => monolithicStructureGeometryCacheStore.getDebugCacheMetrics(),
});

registerCacheMetricSource({
  name: "staticAtlas",
  budgetBytes: 96 * 1024 * 1024,
  sample: () => staticAtlasStore.getDebugCacheMetrics(),
});

registerCacheMetricSource({
  name: "dynamicAtlas",
  budgetBytes: 96 * 1024 * 1024,
  sample: () => dynamicAtlasStore.getDebugCacheMetrics(),
});

registerCacheMetricSource({
  name: "sharedWorldAtlas",
  budgetBytes: 96 * 1024 * 1024,
  sample: () => sharedWorldAtlasStore.getDebugCacheMetrics(),
});

registerCacheMetricSource({
  name: "structureMergedSlices",
  budgetBytes: 96 * 1024 * 1024,
  sample: () => structureMergedSliceCacheStore.getDebugCacheMetrics(),
});
