# Presentation / Rendering Pipeline

## Purpose

- Transform current world state into visible world, screen-overlay, and UI output each frame.
- Own camera projection, viewport/culling, drawable collection, render-command ordering, cache/atlas coordination, backend routing, and final submission to Canvas2D and WebGL surfaces.

## Scope

- `renderSystem()` in `src/game/systems/presentation/render.ts`
- Presentation frame preparation, viewport/culling, and camera bootstrap
- Active palette resolution plus palette-aware sprite acquisition and remap inputs in:
  - `src/game/render/activePalette.ts`
  - `src/engine/render/sprites/renderSprites.ts`
  - `src/engine/render/palette/paletteSwap.ts`
- Render-command construction and ordering
- Render-piece materialization into prepared world pieces and auxiliary commands
- Ground/entity/effect/structure drawable collection
- Atlas and cache synchronization used by rendering
- Render backend selection and fallback between WebGL and Canvas2D
- Screen-overlay command submission and the final UI pass

## Non-scope

- App-level frame scheduling and pause/loading/menu state transitions owned by the Game Runtime / App Loop system
- The world data model itself
- Gameplay/simulation logic that mutates world state before rendering
- Audio playback, even though `src/game/systems/presentation/audio.ts` lives under the same folder
- Authored map compilation and world-state initialization outside the render-time queries this system performs

## Key Entrypoints

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

## Data Flow / Pipeline

1. **Frame Setup**
   - `renderSystem()` derives device/CSS canvas sizes, effective DPR, visible tile count, and overlay-canvas state.
   - It constructs a `ViewportTransform`, clears the world and overlay canvases, and writes camera-safe-rect metadata back into `world.cameraSafeRect`.
   - It lazily triggers one-time sprite preload flags on the world object for enemy, vendor, neutral, and generic render sprites.

2. **Camera Bootstrap**
   - The player world position is projected into isometric space.
   - `resolveCameraBootstrap()` determines the camera projected position using:
     - snapshot-viewer override, if present
     - otherwise the world camera state with optional smoothing
   - The viewport is then centered on the resolved projected camera position.

3. **Viewport / Culling Derivation**
   - `buildViewportCulling()` derives:
     - base culling view
     - padded tile view rect
     - strict viewport tile bounds
     - projected viewport rect
     - tile inclusion/intersection predicates
   - These values become the frame’s tile admission rules for collection and structure slicing.

4. **Active Palette Resolution and Sprite Variant Context**
   - `resolveActivePaletteId()` chooses the live palette:
     - system override palette when palette swap is enabled
     - otherwise the authored active map-skin palette
   - `resolveActivePaletteSwapWeightPercents()` resolves either:
     - system override `paletteSWeightPercent` / `paletteDarknessPercent`
     - or the authored active map-skin palette entry weights
   - `buildPaletteVariantKey()` encodes the resolved palette context as `paletteId@@sw:{sWeightPercent}@@dk:{darknessPercent}`.
   - Palette-managed runtime sprites (`tiles/`, `structures/`, `props/`, `entities/`) load from base runtime art and are remapped once at load time, not per frame.
   - `remapRgbaByHueLockInPlace(...)`:
     - chooses the nearest palette HSV anchor by circular hue distance
     - blends source saturation toward the selected palette-anchor saturation by `sWeight`
     - applies darkness as a final value multiplier
     - preserves alpha
     - applies even to low-saturation pixels; there is no neutral-lane exemption in the live path
   - When an enabled remapped variant is still pending, the sprite loader keeps a transparent placeholder for that cache key rather than exposing the unremapped base image.

5. **Per-Frame Cache / Atlas Synchronization**
   - `syncCanvasGroundChunkCacheForFrame()` synchronizes the ground chunk cache for the current map/palette/context.
   - `resolveRenderBackendSelection()` chooses the requested/selected backend using current render settings and WebGL surface availability.
   - `resolveEffectiveWorldAtlasMode()` chooses between:
     - shared world atlas mode
     - split static + dynamic atlas mode
   - The relevant atlas stores are synchronized:
     - `staticAtlasStore`
     - `dynamicAtlasStore`
     - `sharedWorldAtlasStore`
   - `structureMergedSliceCacheStore` and structure-triangle cache context are reset when their context keys change.

6. **Frame Context Construction**
   - `prepareRenderFrame()` currently returns the provided `RenderFrameContext` unchanged.
   - The render frame is still materialized explicitly and becomes the shared contract passed into collection and later UI/debug stages.

7. **Drawable Collection**
   - `collectFrameDrawables()` runs collection in fixed order:
     1. `collectGroundDrawables()`
     2. `collectEffectDrawables()`
     3. `collectEntityDrawables()`
     4. `collectStructureDrawables()`
   - Collectors enqueue commands into a `RenderFrameBuilder`.
   - Ground collection may suppress projected commands when a ground chunk cache tile is authoritative.
   - Entity collection uses dynamic-atlas lookup for image-backed sprites where possible.
   - Structure collection builds sliced/merged/static-atlas-backed structure submissions and returns whether structure cutout debug geometry was queued.

8. **Screen-Overlay Command Enqueue**
   - `renderScreenOverlays()` does not draw directly to the canvases.
   - It enqueues:
     - screen-space tint overlays
     - ambient-darkness overlays
     - debug screen/world primitives
     - floating-combat-text world-tail placeholder
     - optional heightmap-shadow debug/screen data

9. **Command Finalization and Ordering**
   - `finalizeRenderFrame()` sorts slice buckets by slice index and then sorts commands inside each slice with `compareRenderKeys()`.
   - It splits commands into:
     - `ground`
     - `world`
     - `screen`
   - `buildRenderExecutionPlan()` then interleaves world commands by z-band:
     - ground slice commands for the band
     - world-band commands for the band
     - world slice commands for the band
     - then appends world-tail commands
   - Once this ordered world stream is built, there is no later structure/occluder/light-specific phase authority that can reorder competing world drawables.

10. **Render Piece Materialization**
   - `createRenderWorld()` converts ordered execution-plan commands into:
     - `orderedPieces`
     - `auxiliaryWorldCommands`
     - `screenCommands`
     - `auditWorldCommands`
   - `createGroundPiece()` and `createStructurePiece()` materialize `StaticWorldQuadRenderPiece` values.
   - `createDynamicPiece()` materializes `DynamicRectRenderPiece` values.
   - Only quad world-image commands become concrete world pieces.
   - WORLD primitives, debug primitives, and other unsupported WORLD commands remain auxiliary commands instead of render pieces.

11. **Backend Submission**
   - If WebGL is selected and a renderable WebGL surface exists:
      - `renderWorldPiecesWebGL()` submits supported world pieces through `WorldQuadWebGLBatcher`
      - unsupported dynamic pieces are returned as canvas fallback pieces
      - fallback pieces are drawn with `renderDynamicFallbackPiecesCanvas()`
      - auxiliary world commands and screen commands are drawn through `Canvas2DRenderer`
    - If WebGL throws during submission:
      - the render system records WebGL runtime failure
      - switches visibility to Canvas2D
      - redraws the frame through the Canvas2D path
    - If Canvas2D is selected from the start:
      - `renderWorldPiecesCanvas()` draws ordered world pieces
      - `Canvas2DRenderer` draws auxiliary world commands and screen commands

12. **Final UI Pass**
   - After world/screen submission and perf-frame finalization, `renderUiPass()` draws overlay UI directly.
   - This pass includes:
      - nav arrow rendering when an overlay canvas exists and the world is in `RUN` + `FLOOR`
      - debug screen/grid overlays
      - DPS meter
      - death-FX overlay

## Core Invariants

- `renderSystem()` is the top-level presentation entrypoint for a visual frame.
- `prepareRenderFrame()` currently performs no transformation and returns its input frame context unchanged.
- Drawable collection order is fixed:
  1. ground
  2. effects
  3. entities
  4. structures
- Render commands are classified by:
  - pass: `GROUND`, `WORLD`, `SCREEN`
  - semantic family
  - final form: `quad` or `primitive`
  - stage: `slice`, `band`, or `tail`
- `enqueueSliceCommand()` derives pass from `KindOrder`:
  - ground kinds -> `GROUND`
  - world kinds -> `WORLD`
- Slice-command ordering is deterministic and based on `RenderKey` through `compareRenderKeys()`.
- `compareRenderKeys()` orders slice commands by:
  - `slice`
  - `within`
  - `feetSortY`
  - `kindOrder`
  - structure south tie-breaks when present
  - `stableId`
- `finalizeRenderFrame()` computes `feetSortY` for world kinds that do not already have it.
- `baseZ` is not part of the slice comparator; it participates through z-band resolution only.
- `kindOrder` is a tie-breaker inside equal spatial keys, not a hidden render phase.
- `buildRenderExecutionPlan()` orders world output by z-band and appends tail commands after all z-band passes.
- There is no separate late structure composite, occluder pass, or second world-depth authority after `buildRenderExecutionPlan()` produces the ordered world stream.
- Active palette context is variant-keyed by palette id plus saturation-weight and darkness percentages, not by palette id alone.
- Palette-managed sprite remap is a load-time/on-demand cache transform, not a per-frame presentation stage.
- Enabled palette variants do not expose the unremapped base image while the remapped cache entry is still pending.
- Hue-lock palette remap uses circular nearest-hue selection, preserves alpha, and applies even to low-saturation pixels; there is no neutral-lane exemption in the live path.
- `createRenderWorld()` only turns recognized command shapes into render pieces; other WORLD commands remain auxiliary commands.
- World image submission is prepared-piece only:
  - ground and structure imagery become static-world quad pieces
  - dynamic world imagery becomes dynamic rect pieces
  - consumers receive chosen images, source rects, blend mode, and destination geometry rather than recomputing semantic structure data
- Screen commands are not part of the final UI pass; they are executed as `screenCommands` through the auxiliary canvas renderer before `renderUiPass()`.
- `renderUiPass()` draws the nav arrow only when:
  - an overlay canvas exists
  - `w.state === "RUN"`
  - `w.runState === "FLOOR"`
- WebGL selection falls back to Canvas2D when:
  - no renderable WebGL surface is available at selection time, or
  - WebGL submission throws at runtime
- Ground chunk cache authority can suppress projected static ground-surface and ground-decal commands for authoritative tiles.
- Atlas/cache context changes can clear or rebuild:
  - static atlas
  - dynamic atlas
  - shared world atlas
  - structure merged-slice cache
  - monolithic structure triangle cache

## Design Constraints

- World-frame rendering must remain centralized through `renderSystem()` and the render-command pipeline; feature code must not bypass this by drawing directly to the world canvas as its primary path.
- Drawable collection order must remain:
  1. ground
  2. effects
  3. entities
  4. structures
  Any change to this ordering is an architectural change and requires canonical-doc updates.
- Screen-overlay commands and the final UI pass are separate rendering stages and must not be merged implicitly; screen commands execute before `renderUiPass()`.
- Consumers and backend submission layers must remain semantic-dumb:
  - they batch and submit prepared pieces
  - they do not choose atlas families
  - they do not recompute projected geometry
  - they do not re-run visibility or ownership decisions
- Render backend choice is an execution detail, not a semantic fork; WebGL and Canvas2D paths must preserve the same ordered frame contract, with fallback maintaining frame correctness.
- Triangle data may still exist for CPU-side semantics, debug primitives, or internal WebGL batching, but it must not re-emerge as a backend-facing world render-piece contract.
- `KindOrder`, semantic family, and blend mode must not be repurposed into hidden phase ownership inside WORLD; competing world drawables still resolve through the shared comparator and z-band pipeline.
- Atlas stores, merged-slice caches, and ground chunk caches are derived acceleration layers only; they must not become authoritative scene state or survive invalid context changes.
- Palette remap must stay upstream of atlas/cache synchronization and render-piece submission; backend consumers cannot become a second authority for palette variant behavior.
- Palette variant keys must include every remap parameter that changes pixels, especially saturation weight and darkness.
- Palette-managed sprite remap remains a load-time/cache/prewarm behavior rather than a per-frame transform unless this document is updated.

## Dependencies (In/Out)

### Incoming

- World state from `src/engine/world/world.ts`
- Render/user settings from `getUserSettings()`
- Map queries and view extraction from compiled-map APIs such as:
  - `surfacesAtXY`
  - `decalsInView`
  - `overlaysInView`
  - `facePiecesInViewForLayer`
  - `occludersInViewForLayer`
- Sprite/image sources from engine sprite loaders and palette-aware sprite accessors
- WebGL surface attachment/failure state from `webglSurface.ts`

### Outgoing

- Ordered render commands and render pieces sent to:
  - `renderWorldPiecesWebGL()`
  - `renderWorldPiecesCanvas()`
  - `renderDynamicFallbackPiecesCanvas()`
  - `Canvas2DRenderer`
- Backend statistics and perf counters sent to render perf tracking
- Camera-safe-rect metadata written back to `world.cameraSafeRect`
- Backend visibility changes applied to the world canvas and attached WebGL canvas

## Extension Points

- `renderSystem()`
- `RenderFrameContext`, `CollectionContext`, and render-command contracts
- `collectGroundDrawables()`
- `collectEffectDrawables()`
- `collectEntityDrawables()`
- `collectStructureDrawables()`
- `KindOrder`, `RenderKey`, and z-band resolution rules
- Atlas/cache stores:
  - `staticAtlasStore`
  - `dynamicAtlasStore`
  - `sharedWorldAtlasStore`
  - `canvasGroundChunkCacheStore`
  - `structureMergedSliceCacheStore`
- Backend submission layers:
  - render-world consumers
  - `Canvas2DRenderer`
  - WebGL surface routing

## Failure Modes / Common Mistakes

- Bypassing the command pipeline and drawing directly to the world canvas breaks ordering, backend routing, and audit/perf accounting.
- Writing commands with unstable or incomplete `RenderKey` data can break deterministic ordering.
- Assuming all world pieces are handled by WebGL is incorrect; unsupported dynamic pieces are explicitly returned for Canvas2D fallback drawing.
- Treating screen commands and UI-pass drawings as the same layer is incorrect; they are separate stages with different execution paths.
- Forgetting cache/atlas context changes when map or palette inputs change can leave stale frames or stale merged structure slices.
- Assuming ground projected commands always emit for static surfaces/decals is incorrect; chunk-authoritative tiles can suppress them.
- Treating `renderSystem()` as owning app-level pause/loading/menu transitions is incorrect; it only reacts to the current world/render state it is given.
- Leaving saturation weight or darkness out of the palette variant key causes stale sprite reuse across palette contexts.
- Treating palette remap as a per-frame post-process or shader stage breaks the loader/cache assumptions used by sprite prewarm, atlas sync, and world collection.
- Adding a grayscale or low-saturation exemption without updating the canonical docs would diverge from the live palette-remap path.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
