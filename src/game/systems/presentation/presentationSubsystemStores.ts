import { StaticRelightBakeStore } from "./staticRelightBake";
import { RuntimeStructureTriangleCacheStore } from "./runtimeStructureTriangles";
import { StructureShadowCacheStore } from "./structureShadowV1";
import { StructureShadowV2CacheStore } from "./structureShadowV2AlphaSilhouette";
import { StructureShadowHybridCacheStore } from "./structureShadowHybridTriangles";
import { StructureShadowV4CacheStore } from "./structureShadowV4";
import { StructureShadowV6CacheStore } from "./structureShadows/structureShadowV6Cache";

export const staticRelightBakeStore = new StaticRelightBakeStore<HTMLCanvasElement>();
export const runtimeStructureTriangleCacheStore = new RuntimeStructureTriangleCacheStore();
export const structureShadowV1CacheStore = new StructureShadowCacheStore();
export const structureShadowV2CacheStore = new StructureShadowV2CacheStore();
export const structureShadowHybridCacheStore = new StructureShadowHybridCacheStore();
export const structureShadowV4CacheStore = new StructureShadowV4CacheStore();
export const structureShadowV6CacheStore = new StructureShadowV6CacheStore();
