import { StaticRelightBakeStore } from "./staticRelightBake";
import { RuntimeStructureTriangleCacheStore } from "../../structures/monolithicStructureGeometry";
import { StructureShadowV6CacheStore } from "./structureShadows/structureShadowV6Cache";
import { CanvasGroundChunkCacheStore } from "./canvasGroundChunkCache";

export const staticRelightBakeStore = new StaticRelightBakeStore<HTMLCanvasElement>();
export const monolithicStructureGeometryCacheStore = new RuntimeStructureTriangleCacheStore();
export const structureShadowV6CacheStore = new StructureShadowV6CacheStore();
export const canvasGroundChunkCacheStore = new CanvasGroundChunkCacheStore();
