import { StaticRelightBakeStore } from "./staticRelightBake";
import { RuntimeStructureTriangleCacheStore } from "../../structures/monolithicStructureGeometry";
import { StructureShadowV6CacheStore } from "./structureShadows/structureShadowV6Cache";
import { CanvasGroundChunkCacheStore } from "./canvasGroundChunkCache";
import { registerCacheMetricSource } from "./cacheMetricsRegistry";

export const staticRelightBakeStore = new StaticRelightBakeStore<HTMLCanvasElement>();
export const monolithicStructureGeometryCacheStore = new RuntimeStructureTriangleCacheStore();
export const structureShadowV6CacheStore = new StructureShadowV6CacheStore();
export const canvasGroundChunkCacheStore = new CanvasGroundChunkCacheStore();

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
  name: "structureShadowMasks",
  budgetBytes: 64 * 1024 * 1024,
  sample: () => structureShadowV6CacheStore.getDebugCacheMetrics(),
});

registerCacheMetricSource({
  name: "staticRelightBakes",
  budgetBytes: 64 * 1024 * 1024,
  sample: () => staticRelightBakeStore.getDebugCacheMetrics(),
});
