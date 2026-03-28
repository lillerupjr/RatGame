import { RuntimeStructureTriangleCacheStore } from "../../structures/monolithicStructureGeometry";
import { CanvasGroundChunkCacheStore } from "./canvasGroundChunkCache";
import { registerCacheMetricSource } from "./cacheMetricsRegistry";
import { StructureSpriteAtlasStore } from "./structureSpriteAtlas";

export const monolithicStructureGeometryCacheStore = new RuntimeStructureTriangleCacheStore();
export const canvasGroundChunkCacheStore = new CanvasGroundChunkCacheStore();
export const structureSpriteAtlasStore = new StructureSpriteAtlasStore();

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
  name: "structureSpriteAtlas",
  budgetBytes: 64 * 1024 * 1024,
  sample: () => structureSpriteAtlasStore.getDebugCacheMetrics(),
});
