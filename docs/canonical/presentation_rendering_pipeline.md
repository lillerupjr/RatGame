# Presentation / Rendering Pipeline

## Purpose

Transform world state into world, screen-overlay, and UI output each frame; own camera projection, viewport/culling, drawable collection, command ordering, cache/atlas coordination, backend routing, and Canvas2D/WebGL submission.

## Scope

- `renderSystem()` in `src/game/systems/presentation/render.ts`
- Frame preparation, camera bootstrap, viewport/culling, render-command construction/order, render-piece materialization, drawable collection, cache/atlas sync, backend selection/fallback, screen overlays, and final UI pass
- Active palette resolution plus palette-aware sprite acquisition/remap inputs in `src/game/render/activePalette.ts`, `src/engine/render/sprites/renderSprites.ts`, and `src/engine/render/palette/paletteSwap.ts`

## Non-scope

- App frame scheduling and pause/loading/menu transitions; see Game Runtime / App Loop
- World data model; gameplay/simulation mutation before render
- Audio playback, though `src/game/systems/presentation/audio.ts` shares the folder
- Authored map compilation and world initialization outside render-time queries

## Entrypoints

- `src/game/systems/presentation/render.ts`
- `src/game/systems/presentation/frame/cameraBootstrap.ts`
- `src/game/systems/presentation/frame/viewportCulling.ts`
- `src/game/systems/presentation/frame/renderFrameBuilder.ts`
- `src/game/systems/presentation/collection/collectFrameDrawables.ts`
- `src/game/systems/presentation/contracts/renderCommands.ts`
- `src/game/systems/presentation/worldRenderOrdering.ts`
- `src/game/systems/presentation/backend/renderBackendSelection.ts`
- `src/game/systems/presentation/backend/renderExecutionPlan.ts`
- `src/engine/render/creator/renderWorldCreator.ts`
- `src/engine/render/consumers/renderWorldConsumers.ts`
- `src/game/render/activePalette.ts`
- `src/engine/render/sprites/renderSprites.ts`
- `src/engine/render/palette/paletteSwap.ts`
- `src/game/systems/presentation/ui/renderScreenOverlays.ts`
- `src/game/systems/presentation/ui/renderUiPass.ts`
- `src/game/systems/presentation/presentationSubsystemStores.ts`

## Pipeline

1. **Frame Setup**: `renderSystem()` derives device/CSS canvas sizes, effective DPR, visible tile count, overlay-canvas state, `ViewportTransform`, canvas clears, `world.cameraSafeRect`, and one-time sprite preload flags.
2. **Camera Bootstrap**: player world position is projected; `resolveCameraBootstrap()` chooses snapshot-viewer override or smoothed world camera state; viewport centers on the resolved projected camera.
3. **Viewport / Culling**: `buildViewportCulling()` returns base/padded/strict tile views, projected viewport rect, and tile predicates used for collection and structure slicing.
4. **Palette Context**: live palette comes from enabled system override or authored map-skin palette. Variant key is `paletteId@@sw:{sWeightPercent}@@dk:{darknessPercent}`. Palette-managed `tiles/`, `structures/`, `props/`, and `entities/` sprites are remapped from base runtime art at load/on-demand time; pending enabled variants expose transparent placeholders, not unremapped base images. Remap uses circular nearest-hue selection, saturation blending by `sWeight`, darkness value multiplier, alpha preservation, and no low-saturation exemption.
5. **Cache / Atlas Sync**: render syncs the ground chunk cache, resolves backend selection, resolves effective world-atlas mode, syncs `staticAtlasStore`, `dynamicAtlasStore`, or `sharedWorldAtlasStore`, and resets merged-slice / triangle cache contexts when keys change. Atlas/cache internals are owned by `docs/canonical/atlas_render_cache_system.md`.
6. **Frame Context**: `prepareRenderFrame()` currently returns the supplied `RenderFrameContext` unchanged; the materialized frame contract is passed to collection, UI, and debug stages.
7. **Drawable Collection**: `collectFrameDrawables()` runs `collectGroundDrawables()`, `collectEffectDrawables()`, `collectEntityDrawables()`, then `collectStructureDrawables()`, enqueueing into `RenderFrameBuilder`. Ground may suppress projected commands for chunk-authoritative tiles; entities may use dynamic-atlas frames; structures may emit sliced, merged, or static-atlas-backed submissions and cutout debug geometry status.
8. **Screen Overlays**: `renderScreenOverlays()` draws nothing directly; it enqueues screen tint, ambient darkness, debug screen/world primitives, floating-combat-text world-tail placeholder, and optional heightmap-shadow debug/screen data.
9. **Finalize / Order**: `finalizeRenderFrame()` sorts slice buckets and commands with `compareRenderKeys()`, splits `ground` / `world` / `screen`, and `buildRenderExecutionPlan()` interleaves world output by z-band: ground slice commands, world-band commands, world slice commands, then world-tail commands. No later structure, occluder, or light phase may reorder competing world drawables.
10. **Materialization**: `createRenderWorld()` converts ordered commands into `orderedPieces`, `auxiliaryWorldCommands`, `screenCommands`, and `auditWorldCommands`. Only quad world-image commands become pieces: ground/structure -> `StaticWorldQuadRenderPiece`; dynamic imagery -> `DynamicRectRenderPiece`. WORLD primitives, debug primitives, and unsupported WORLD commands remain auxiliary commands.
11. **Backend Submission**: WebGL submits supported pieces through `renderWorldPiecesWebGL()` / `WorldQuadWebGLBatcher`; unsupported dynamic pieces return to Canvas2D fallback via `renderDynamicFallbackPiecesCanvas()`, while auxiliary world and screen commands use `Canvas2DRenderer`. WebGL selection falls back to Canvas2D when no renderable surface exists or submission throws; Canvas2D start path uses `renderWorldPiecesCanvas()` plus `Canvas2DRenderer`.
12. **Final UI Pass**: after world/screen submission and perf finalization, `renderUiPass()` draws overlay UI directly: nav arrows only with overlay canvas and `RUN` + `FLOOR`, plus debug screen/grid overlays, DPS meter, and death-FX overlay.

## Invariants

- `renderSystem()` is the top-level presentation entrypoint for a visual frame.
- Render commands are classified by pass (`GROUND`, `WORLD`, `SCREEN`), semantic family, final form (`quad` / `primitive`), and stage (`slice`, `band`, `tail`).
- `enqueueSliceCommand()` derives pass from `KindOrder`: ground kinds -> `GROUND`; world kinds -> `WORLD`.
- `compareRenderKeys()` orders slice commands by `slice`, `within`, `feetSortY`, `kindOrder`, structure south tie-breaks when present, then `stableId`.
- `finalizeRenderFrame()` computes `feetSortY` for world kinds that do not already have it.
- `baseZ` is not part of the slice comparator; it participates only through z-band resolution.
- `kindOrder` is an equal-spatial-key tie-breaker, not a hidden render phase.
- World image submission is prepared-piece only: consumers receive chosen images, source rects, blend mode, and destination geometry rather than recomputing semantic structure data.
- Screen commands execute through the auxiliary canvas renderer before `renderUiPass()`; they are not final-UI-pass commands.

## Constraints

- Drawing directly to the world canvas as a feature path breaks ordering, backend routing, audit, and perf accounting.
- Changing drawable collection order is an architectural change requiring canonical-doc updates.
- Merging screen commands with the final UI pass crosses stages with different coordinate/execution contracts.
- Consumers and backend submission layers must stay semantic-dumb: no atlas-family choice, projected-geometry recomputation, visibility decisions, or ownership decisions.
- Backend choice is an execution detail, not a semantic fork; WebGL and Canvas2D must preserve the same ordered-frame contract and frame-correct fallback.
- Triangle data may exist for CPU semantics, debug primitives, or internal WebGL batching, but must not re-emerge as a backend-facing world render-piece contract.
- `KindOrder`, semantic family, and blend mode must not become hidden WORLD phase ownership; competing world drawables resolve through the shared comparator and z-band pipeline.
- Atlas stores, merged-slice caches, and ground chunk caches are derived acceleration only; authority and invalidation rules belong to `docs/canonical/atlas_render_cache_system.md`.
- Palette remap must stay upstream of atlas/cache sync and render-piece submission; backend consumers cannot decide palette variant behavior. Variant keys must include every pixel-changing remap parameter, especially saturation weight and darkness.

## Dependencies

### Incoming

- World state from `src/engine/world/world.ts`
- Render/user settings from `getUserSettings()`
- Compiled-map view/query APIs: `surfacesAtXY`, `decalsInView`, `overlaysInView`, `facePiecesInViewForLayer`, `occludersInViewForLayer`
- Sprite/image sources from engine sprite loaders and palette-aware sprite accessors
- WebGL surface attachment/failure state from `webglSurface.ts`

### Outgoing

- Ordered render commands and pieces sent to `renderWorldPiecesWebGL()`, `renderWorldPiecesCanvas()`, `renderDynamicFallbackPiecesCanvas()`, and `Canvas2DRenderer`
- Backend stats and perf counters
- `world.cameraSafeRect`
- World-canvas and attached-WebGL-canvas visibility changes

## Extension

- `renderSystem()`
- `RenderFrameContext`, `CollectionContext`, and render-command contracts
- `collectGroundDrawables()`, `collectEffectDrawables()`, `collectEntityDrawables()`, `collectStructureDrawables()`
- `KindOrder`, `RenderKey`, and z-band resolution rules
- Atlas/cache stores: `staticAtlasStore`, `dynamicAtlasStore`, `sharedWorldAtlasStore`, `canvasGroundChunkCacheStore`, `structureMergedSliceCacheStore`
- Backend submission layers: render-world consumers, `Canvas2DRenderer`, WebGL surface routing

## Failure Modes

- Unstable or incomplete `RenderKey` data breaks deterministic ordering.
- Assuming all world pieces are WebGL-capable skips the explicit Canvas2D dynamic fallback path.
- Treating `renderSystem()` as owning app-level pause/loading/menu transitions confuses renderer reaction with app-state authority.
- Treating palette remap as a per-frame post-process or shader stage breaks sprite prewarm, atlas sync, and world collection assumptions.
- Adding a grayscale or low-saturation palette exemption without canonical-doc updates diverges from the live remap path.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
