# Atlas / Render Cache System

## Purpose

Own derived presentation acceleration: atlas pages, ground-chunk raster cache, merged structure-slice cache, and cache-metric sampling. These layers accelerate rendering but are not authoritative scene state.

## Scope

- Singleton stores and metric registration in `src/game/systems/presentation/presentationSubsystemStores.ts`
- Atlas stores: `src/game/systems/presentation/staticAtlasStore.ts`, `dynamicAtlasStore.ts`, `sharedWorldAtlasStore.ts`
- Atlas sources/page packing: `dynamicAtlasSources.ts`, `staticStructureSpriteInventory.ts`, `atlasPageBuilder.ts`
- Ground chunk cache: `src/game/systems/presentation/canvasGroundChunkCache.ts`
- Structure merged-slice cache: `src/game/systems/presentation/structures/structureMergedSliceCache.ts`
- Cache metrics: `src/game/systems/presentation/cacheMetricsRegistry.ts`
- Render-time sync/lookup handoff in `src/game/systems/presentation/render.ts`

## Non-scope

- Render ordering, backend submission, final composition: `docs/canonical/presentation_rendering_pipeline.md`
- Structure geometry, overlay slicing, triangle extraction/cache semantics: `docs/canonical/structure_geometry_slicing_system.md`
- Shadow mask / structure shadow cache behavior: `docs/canonical/shadow_lighting_system.md`
- Sprite asset loading internals; this system consumes ready/pending/failed sprite state
- Compiled-map generation and authored map activation: `docs/canonical/map_compilation_activation_floor_topology.md`

## Entrypoints

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

## Pipeline

1. **Stores / Metrics**: `presentationSubsystemStores.ts` creates process-wide `canvasGroundChunkCacheStore`, `staticAtlasStore`, `dynamicAtlasStore`, `sharedWorldAtlasStore`, and `structureMergedSliceCacheStore`, then registers metric sources. Sampling is centralized; each cache owns storage/invalidation.
2. **Ground Chunks**: `render.ts` keys ground chunks by compiled map id, palette variant key, render-all-heights flag, and active floor height. `syncCanvasGroundChunkCacheForFrame()` builds missing visible/grace chunks, retries pending-input chunks, evicts outside grace bounds, and marks authoritative chunks that may suppress fallback ground commands.
3. **Atlas Mode**: `render.ts` resolves effective world-atlas mode from settings/backend: `shared` for requested shared or auto-WebGL, `dual` for requested dual or auto-Canvas2D. Switching to `shared` clears `dynamicAtlasStore`; switching to `dual` clears `sharedWorldAtlasStore`.
4. **Atlas Build**: `StaticAtlasStore.sync()` enumerates static structure sprites plus projected decals; `DynamicAtlasStore.sync()` snapshots currency, projectiles, VFX, vendor NPC, neutral mobs, player, enemies, and bosses; `SharedWorldAtlasStore.sync()` combines static structure sources plus the dynamic sources. `buildAtlasPages()` packs ready positive-size images with bleed/safe borders; pending/fallback sources wait for later sync.
5. **Mode Responsibilities**: in `dual`, static atlas serves structures/decals and dynamic atlas serves runtime imagery. In `shared`, static atlas still serves projected decals; shared atlas serves structure sprites plus dynamic runtime imagery.
6. **Lookup / Fallback**: ground checks chunk tile authority before emitting projected surfaces/decals; entities look up by source image; structures look up by sprite id. Atlas hits substitute page/source rect; misses fall back to original image. Perf counters record requests, hits, misses, and fallbacks.
7. **Merged Slices**: `render.ts` resets merged-slice cache on context changes keyed by map id, atlas mode, palette variant key, and active structure-atlas generation. `collectStructureDrawables()` uses it for eligible coarse merged groups and validates `structureInstanceId`, `groupStableId`, `geometrySignature`, and `sourceFrameKey`.
8. **Metrics**: `sampleCacheMetricsRegistry()` polls registered caches and classifies status from explicit budgets, growth streaks, and bounded/unbounded behavior; `renderPerfCounters.ts` carries snapshots to frame/aggregate perf output.

## Invariants

- Store instances exported from `presentationSubsystemStores.ts` are shared across frames.
- Atlas context keys: static = compiled map id + palette variant key + `includeSpriteSources` + `includeProjectedDecals`; dynamic = palette variant key; shared = compiled map id + palette variant key.
- Atlas pages contain only ready positive-dimension images.
- Atlas lookup never blocks; pending/failed/unsupported sources use direct-source fallback.
- Atlas mode resolves before collection; backend submission never chooses atlas family.
- Effective mode changes clear the inactive atlas family before later lookups.
- Projected decals always resolve through `StaticAtlasStore`; shared world atlas does not absorb them.
- Ground-chunk rasters are a separate texture domain and never enter static/dynamic/shared atlas pages.
- Ground chunk authority requires a build with no pending visual change; suppression is tile-authority based, not cache-presence based.
- `StructureMergedSliceCacheStore.get()` deletes entries with stale geometry signature or source frame key.
- `CacheMetricsRegistry.sample()` observes caches only; it does not own eviction/rebuild policy.

## Constraints

- Caches must stay derived acceleration layers; making them authoritative creates scene-state drift.
- Any map, palette, atlas-mode, or source-frame change that can alter output must invalidate the relevant cache path.
- Pending/stale ground chunks must not suppress fallback ground rendering.
- Merged-slice reuse must validate geometry and source-frame identity, not stable ids alone.
- Metrics may classify growth/budget pressure, but cache lifecycle decisions remain inside cache owners.

## Dependencies

### Incoming

- Compiled-map surfaces, decals, overlays, face pieces, occluders
- Palette variant key and world-atlas mode from settings/render state
- Sprite readiness/image records from render-sprite loaders
- Projected-decal and diamond-fit image transforms
- Frame view rect, active floor height, building-cull predicates
- Structure quad payloads for merged-slice population

### Outgoing

- Atlas frame lookups for ground/entity/structure collection
- Ground-chunk authority and pieces for the render pipeline
- Cache generation values for merged-slice invalidation
- Cache metric snapshots for render perf/debug surfaces

## Extension

- `buildAtlasPages()`
- `collectDynamicAtlasSources()`
- `buildUniqueStaticStructureSpriteIds()`
- Store context-key builders and sync-input contracts
- `registerCacheMetricSource()` / `sampleCacheMetricsRegistry()`
- `resolveEffectiveWorldAtlasMode()`
- Ground-chunk target bounds, grace bounds, and retry policy

## Failure Modes

- Missing palette/map/atlas-mode invalidation leaves stale atlas frames or merged-slice rasters.
- Adding runtime sprite families without `collectDynamicAtlasSources()` excludes them from dynamic/shared atlas lookup.
- Unstable/incomplete source keys cause misses, incorrect reuse, or rebuild churn.
- Reusing merged slices after source-frame changes renders correct geometry with wrong texture content.
- Treating metric bytes as allocator truth overreads approximate sampled diagnostics.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
