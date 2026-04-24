# Atlas / Render Cache System

## Purpose

- Provide the derived atlas and render-cache layers that accelerate presentation without becoming authoritative scene state.
- Own atlas page construction, ground-chunk raster caching, merged structure-slice caching, and cache-metrics sampling for the presentation stack.

## Scope

- Singleton cache-store wiring in `src/game/systems/presentation/presentationSubsystemStores.ts`
- Atlas stores:
  - `src/game/systems/presentation/staticAtlasStore.ts`
  - `src/game/systems/presentation/dynamicAtlasStore.ts`
  - `src/game/systems/presentation/sharedWorldAtlasStore.ts`
- Atlas source discovery and page packing:
  - `src/game/systems/presentation/dynamicAtlasSources.ts`
  - `src/game/systems/presentation/staticStructureSpriteInventory.ts`
  - `src/game/systems/presentation/atlasPageBuilder.ts`
- Ground-chunk raster cache:
  - `src/game/systems/presentation/canvasGroundChunkCache.ts`
- Structure merged-slice cache:
  - `src/game/systems/presentation/structures/structureMergedSliceCache.ts`
- Cache metric registration and sampling:
  - `src/game/systems/presentation/cacheMetricsRegistry.ts`
- Render-time cache/atlas synchronization and lookup handoff in `src/game/systems/presentation/render.ts`

## Non-scope

- Render-command ordering, backend submission, and final frame composition
- Structure-triangle cache implementation in `src/game/structures/monolithicStructureGeometry.ts`
- Structure geometry generation, overlay slicing, and triangle extraction logic
- Shadow-mask and structure-shadow cache implementations
- Sprite asset loading itself; this system only consumes ready/pending/failed sprite state
- Compiled-map generation and authored map activation

## Key Entrypoints

- `src/game/systems/presentation/presentationSubsystemStores.ts`
- `src/game/systems/presentation/render.ts`
- `src/game/systems/presentation/staticAtlasStore.ts`
- `src/game/systems/presentation/dynamicAtlasStore.ts`
- `src/game/systems/presentation/sharedWorldAtlasStore.ts`
- `src/game/systems/presentation/dynamicAtlasSources.ts`
- `src/game/systems/presentation/staticStructureSpriteInventory.ts`
- `src/game/systems/presentation/atlasPageBuilder.ts`
- `src/game/systems/presentation/canvasGroundChunkCache.ts`
- `src/game/systems/presentation/structures/structureMergedSliceCache.ts`
- `src/game/systems/presentation/cacheMetricsRegistry.ts`
- `src/game/systems/presentation/collection/collectGroundDrawables.ts`
- `src/game/systems/presentation/collection/collectEntityDrawables.ts`
- `src/game/systems/presentation/collection/collectStructureDrawables.ts`
- `src/game/systems/presentation/renderPerfCounters.ts`

## Data Flow / Pipeline

1. **Store and Metric Registration**
   - `presentationSubsystemStores.ts` creates process-wide singleton instances for:
     - `canvasGroundChunkCacheStore`
     - `staticAtlasStore`
     - `dynamicAtlasStore`
     - `sharedWorldAtlasStore`
     - `structureMergedSliceCacheStore`
   - The same module registers cache metric sources with `cacheMetricsRegistry`.
   - Metric sampling is centralized, but the underlying caches retain their own storage and invalidation logic.

2. **Ground-Chunk Cache Synchronization**
   - `render.ts` builds a ground-chunk cache context key from:
     - compiled map id
     - palette variant key
     - render-all-heights flag
     - active floor height
   - `syncCanvasGroundChunkCacheForFrame()` then:
     - derives target logical chunks from the frame view rect
     - expands a grace window around the visible chunk range
     - builds missing chunk rasters from static ground-surface and ground-decal commands
     - retries non-authoritative chunks whose visual inputs were still pending
     - evicts retained chunks that fall outside the grace window
   - Authoritative chunks expose ready-to-draw static world pieces and can suppress fallback projected ground commands in later collection.

3. **Atlas Mode Resolution**
   - `render.ts` resolves the effective world-atlas mode from render settings and selected backend:
     - `shared` when shared mode is requested, or when `auto` resolves to WebGL
     - `dual` when dual mode is requested, or when `auto` resolves to Canvas2D
   - When the effective mode changes:
     - switching to `shared` clears `dynamicAtlasStore`
     - switching to `dual` clears `sharedWorldAtlasStore`

4. **Atlas Source Collection and Page Build**
   - `StaticAtlasStore.sync()` enumerates static structure sprite ids map-wide through `buildUniqueStaticStructureSpriteIds()` and unique projected-decal lookups from compiled-map decals.
   - `DynamicAtlasStore.sync()` snapshots runtime sprite families from `collectDynamicAtlasSources()`:
     - currency
     - projectile travel
     - VFX
     - vendor NPC
     - neutral mobs
     - player
     - enemies
     - bosses
   - `SharedWorldAtlasStore.sync()` combines:
     - static structure sprite sources
     - the same dynamic runtime sources
   - `buildAtlasPages()` packs ready images into one or more canvas pages, adding bleed and safe borders and returning per-source frame rects for lookup.
   - Sources that are not ready stay in pending/fallback sets and are omitted from atlas pages until a later sync.

5. **Mode-Specific Atlas Responsibilities**
   - In `dual` mode:
     - `staticAtlasStore` serves structure sprites and projected decals
     - `dynamicAtlasStore` serves runtime entity / VFX / projectile imagery
   - In `shared` mode:
     - `staticAtlasStore` continues serving projected decals
     - `sharedWorldAtlasStore` serves both static structure sprite sources and dynamic runtime imagery through one shared lookup surface

6. **Consumer Lookup and Fallback**
   - Ground collection consults ground-chunk tile authority before emitting static projected surfaces or decals.
   - Entity collection asks for atlas frames by source image:
     - hit -> substitute atlas page + source rect
     - miss -> fall back to the original image
   - Structure collection asks for atlas frames by sprite id and can render directly from atlas-backed structure images when present.
   - Atlas requests and hit/miss/fallback counters are recorded in render perf counters.

7. **Merged Structure-Slice Cache**
   - `render.ts` resets `structureMergedSliceCacheStore` when the merged-slice context changes.
   - The merged-slice context is keyed from:
     - map id
     - effective atlas mode
     - palette variant key
     - active structure-atlas generation
   - `collectStructureDrawables()` uses the cache only for eligible coarse merged groups.
   - Cache lookup validates:
     - `structureInstanceId`
     - `groupStableId`
     - `geometrySignature`
     - `sourceFrameKey`
   - On miss, `buildStructureMergedSliceCacheEntry()` rasterizes accepted quads into a stable canvas entry and stores it for later reuse.

8. **Metrics Sampling**
   - `sampleCacheMetricsRegistry()` polls all registered cache sources.
   - The registry computes per-cache status from:
     - explicit byte or entry budgets
     - observed growth streaks
     - bounded/unbounded cache behavior
   - `renderPerfCounters.ts` includes the sampled cache-metric snapshot in per-frame and aggregated perf snapshots.

## Core Invariants

- `presentationSubsystemStores.ts` exports singleton cache-store instances shared across frames.
- `StaticAtlasStore` context is keyed by:
  - compiled map id
  - palette variant key
  - `includeSpriteSources`
  - `includeProjectedDecals`
- `DynamicAtlasStore` context is keyed only by palette variant key.
- `SharedWorldAtlasStore` context is keyed by compiled map id and palette variant key.
- Atlas pages are built only from ready images with positive dimensions.
- Atlas frame lookup never blocks on pending sources; misses fall back to non-atlas rendering.
- Atlas mode is resolved before collection, and callers receive either a concrete atlas frame or a direct-source fallback rather than deferring atlas-family choice to backend submission.
- Effective atlas-mode changes clear the inactive atlas family before subsequent lookups.
- Projected decals always resolve through `StaticAtlasStore`; shared world atlas mode does not absorb them.
- Ground-chunk raster surfaces remain a separate texture domain and are never packed into static, dynamic, or shared atlas pages.
- `CanvasGroundChunkCacheStore` retains logical chunks across frames and evicts retained chunks outside the grace bounds.
- A ground chunk is authoritative only when it was built without pending visual change.
- Ground fallback suppression is tile-authority based, not merely cache-presence based.
- `StructureMergedSliceCacheStore.get()` deletes entries whose geometry signature or source frame key no longer match the requested values.
- `CacheMetricsRegistry.sample()` observes registered caches through sampling; it does not own cache eviction or rebuild policy.

## Design Constraints

- All atlas stores and render caches are derived acceleration layers only; they must not become authoritative world or structure state.
- Cache invalidation must remain explicit and context-keyed. Any change to map, palette, atlas mode, or source-frame identity that can change rendered output must invalidate the relevant cache path.
- Atlas routing must be decided before render-piece submission. Canvas2D/WebGL consumers must not become a second authority for atlas-family choice.
- Direct-source fallback for pending, failed, or unsupported sources is part of the contract and must remain correct in both `dual` and `shared` modes.
- Ground-command suppression may occur only for authoritative ground chunks; pending or stale chunks must not hide fallback rendering.
- Merged structure-slice reuse must remain validated against both geometry and source-frame identity, not just stable ids.
- Metrics sampling must stay observational. The registry can classify growth and budget pressure, but it must not become the control path for cache lifecycle decisions.

## Dependencies (In/Out)

### Incoming

- Compiled-map data used for cache source enumeration and rasterization:
  - surfaces
  - decals
  - overlays
  - face pieces
  - occluders
- Palette variant key and world-atlas mode selection from settings/render state
- Sprite readiness and image records from render-sprite loaders
- Runtime image transforms such as projected-decal and diamond-fit canvases
- Frame view rect, active floor height, and building-cull predicates from the render pipeline
- Structure-collection quad payloads for merged-slice cache population

### Outgoing

- Atlas frame lookups used by:
  - ground collection
  - entity collection
  - structure collection
- Authoritative ground-chunk visibility and piece retrieval used by the render pipeline
- Cache generation values used for merged-slice cache invalidation
- Cache metric snapshots consumed by render perf counters and debug/perf surfaces

## Extension Points

- `buildAtlasPages()`
- `collectDynamicAtlasSources()`
- `buildUniqueStaticStructureSpriteIds()`
- Context-key builders and sync-input contracts for each store
- `registerCacheMetricSource()` and `sampleCacheMetricsRegistry()`
- Mode selection through `resolveEffectiveWorldAtlasMode()`
- Ground-chunk rebuild policy:
  - target bounds
  - grace bounds
  - retry timing

## Failure Modes / Common Mistakes

- Forgetting to invalidate on palette, map, or atlas-mode changes can leave stale atlas frames or stale merged-slice rasters in use.
- Treating any cached ground chunk as authoritative before pending visual inputs settle can suppress valid fallback ground rendering.
- Adding new runtime sprite families without extending `collectDynamicAtlasSources()` leaves those images outside the dynamic/shared atlas path.
- Using unstable or incomplete source keys causes atlas misses, incorrect reuse, or unnecessary rebuild churn.
- Reusing merged slice entries after source-frame changes can render correct geometry with the wrong texture content.
- Assuming cache metrics imply exact memory ownership is incorrect; the registry reports sampled approximate bytes and growth state, not allocator-truth.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
