import { RuntimeStructureTriangleCacheStore } from "../../structures/monolithicStructureGeometry";
import { CanvasGroundChunkCacheStore } from "./canvasGroundChunkCache";
import { registerCacheMetricSource } from "./cacheMetricsRegistry";
import { DynamicAtlasStore } from "./dynamicAtlasStore";
import { SharedWorldAtlasStore } from "./sharedWorldAtlasStore";
import { StaticAtlasStore } from "./staticAtlasStore";

export const monolithicStructureGeometryCacheStore = new RuntimeStructureTriangleCacheStore();
export const canvasGroundChunkCacheStore = new CanvasGroundChunkCacheStore();
export const staticAtlasStore = new StaticAtlasStore();
export const dynamicAtlasStore = new DynamicAtlasStore();
export const sharedWorldAtlasStore = new SharedWorldAtlasStore();

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
