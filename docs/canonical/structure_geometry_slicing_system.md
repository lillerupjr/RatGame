# Structure Geometry / Slicing System

## Purpose

- Derive monolithic structure geometry from authored structure sprites and turn that geometry into runtime slice-owned structure pieces.
- Own the semantic prepass, runtime structure-triangle cache build path, structure-overlay admission, triangle-group slicing, and structure drawable derivation used before final render submission.

## Scope

- Monolithic semantic geometry prepass in:
  - `src/game/structures/monolithicBuildingSemanticPrepass.ts`
  - `src/game/structures/getStructureAnchor.ts`
  - `src/game/structures/getStructureSlices.ts`
  - `src/game/structures/buildMonolithicDebugSliceTriangles.ts`
- Runtime monolithic structure geometry and triangle-cache logic in:
  - `src/game/structures/monolithicStructureGeometry.ts`
- Structure overlay admission, candidate collection, slice building, and drawable derivation in:
  - `src/game/systems/presentation/structures/structureOverlayAdmission.ts`
  - `src/game/systems/presentation/structures/collectStructureOverlays.ts`
  - `src/game/systems/presentation/structures/buildStructureSlices.ts`
  - `src/game/systems/presentation/structures/buildStructureDrawables.ts`
  - `src/game/systems/presentation/structures/structurePresentationTypes.ts`
- Runtime structure-triangle semantic labeling used during slice build via:
  - `src/game/systems/presentation/structureShadows/structureTriangleSemantics.ts`
- Loading-time structure-triangle preparation and render-time rebuild triggers in:
  - `src/game/game.ts`
  - `src/game/systems/presentation/render.ts`

## Non-scope

- Map compilation and active-map ownership outside this system’s semantic-prepass dependency
- Atlas stores, merged-slice cache storage, and ground-chunk cache storage
- Final render-command ordering and backend submission
- Structure shadow orchestration, shadow-mask rasterization, and lighting application
- Generic non-structure overlay rendering paths that stay as direct overlays

## Key Entrypoints

- `src/game/structures/monolithicBuildingSemanticPrepass.ts`
- `src/game/structures/monolithicStructureGeometry.ts`
- `src/game/structures/getStructureAnchor.ts`
- `src/game/structures/getStructureSlices.ts`
- `src/game/structures/buildMonolithicDebugSliceTriangles.ts`
- `src/game/systems/presentation/structures/structureOverlayAdmission.ts`
- `src/game/systems/presentation/structures/collectStructureOverlays.ts`
- `src/game/systems/presentation/structures/buildStructureSlices.ts`
- `src/game/systems/presentation/structures/buildStructureDrawables.ts`
- `src/game/systems/presentation/structures/structurePresentationTypes.ts`
- `src/game/systems/presentation/structureShadows/structureTriangleSemantics.ts`
- `src/game/systems/presentation/collection/collectStructureDrawables.ts`
- `src/game/game.ts`
- `src/game/systems/presentation/render.ts`

## Data Flow / Pipeline

1. **Semantic Geometry Prepass**
   - Canonical monolithic building skins are authored as identity plus sprite path through `makeMonolithicBuilding()`.
   - Direct reads of authored `w`, `h`, and `heightUnits` on those building skins are intentionally blocked; placement geometry must come from semantic prepass output.
   - `collectRequiredMonolithicBuildingSkinIdsForMap()` derives the monolithic building skins a map needs.
   - `computeMonolithicBuildingSemanticsForSkinIds()` / `primeMonolithicBuildingSemanticPrepass()` ensure semantic geometry exists for those skins.
   - For each monolithic sprite variant, `buildMonolithicBuildingSemanticGeometryFromAlphaMap()`:
     - derives an anchor and occupied bounds from sprite alpha
     - builds a work rect and local work anchor
     - generates alternating structure slice bands with `getStructureSlices()`
     - generates zig-zag slice triangles with `buildMonolithicSliceGeometry()`
     - alpha-culls triangles against the sprite silhouette
     - derives footprint dimensions (`n`, `m`), parent-footprint offsets, and selected structure height units
   - If sprite-derived semantic geometry cannot be computed in the current environment, the prepass can still serve a fallback semantic placement record from `MONOLITHIC_BUILDING_SEMANTIC_PLACEMENT_FALLBACK`.
   - The result is stored as canonical monolithic semantic geometry per skin/sprite/flip combination.

2. **Prepass Validation / Required Access**
   - Map activation uses `assertMonolithicBuildingSemanticPrepassComplete()` before compiling maps that need monolithic building semantics.
   - Runtime callers resolve geometry through:
     - `getMonolithicBuildingSemanticGeometryForSprite()`
     - `getRequiredMonolithicBuildingSemanticGeometryForSprite()`
     - placement-geometry helpers such as `getRequiredMonolithicBuildingPlacementGeometryForSprite()`
   - If required semantic geometry is missing, this system throws rather than silently fabricating structure topology.

3. **Overlay Geometry Resolution**
   - At runtime, structure overlays carry semantic structure ids through:
     - `monolithicSemanticSkinId`
     - `monolithicSemanticSpriteId`
     - `seTx` / `seTy`
   - `resolveMonolithicStructureGeometryForOverlay()` and related footprint helpers translate the overlay back to semantic geometry and tile bounds.
   - `buildRuntimeStructureProjectedDraw()` computes the no-camera projected placement for the structure image, using the computed semantic anchor when available and falling back to legacy placement otherwise.

4. **Runtime Triangle Cache Build**
   - `buildMonolithicStructureTriangleCacheForOverlay()` creates the per-overlay runtime triangle cache by:
     - building a geometry signature from structure id, sprite id, semantic key, anchor tile, footprint, flip, draw placement, sprite dimensions, slice offsets, and z
     - converting semantic slice triangles into projected runtime triangles
     - assigning parent-tile ownership from footprint-relative slice ownership
     - assigning semantic sides and height-from-parent values
     - grouping triangles by slice parent tile
   - `RuntimeStructureTriangleCacheStore` stores caches by structure instance id and validates them by geometry signature.
   - `prepareMonolithicStructureTrianglesForLoading()` precomputes caches map-wide during loading.
   - `render.ts` rebuilds the map-wide triangle cache when the runtime structure-triangle context key changes.

5. **Structure Overlay Admission**
   - `resolveStructureOverlayAdmissionContext()` derives the admission context for the frame.
   - For `STRUCTURE` overlays:
     - the overlay prefilter stays map-wide
     - triangle visibility becomes the authority
   - `collectStructureOverlays()` filters overlays, resolves their draw placement, and marks whether each overlay uses runtime structure slicing.

6. **Slice Build**
   - `buildStructureSlices()` processes structure candidates.
   - For runtime-sliced structure overlays it:
     - obtains or rebuilds the runtime triangle cache
     - filters visible triangle groups by the configured admission mode (`viewport`, `renderDistance`, `hybrid`, `compare`)
     - computes structure-triangle semantic info and applies it to the cache
     - updates resolved structural roof height units on the overlay when needed
     - emits `triangleGroup` slice pieces keyed by parent tile ownership
   - If runtime slicing is unavailable, the overlay falls back to a direct overlay slice piece.

7. **Drawable Derivation**
   - `buildStructureDrawables()` converts slice pieces into structure drawables with stable render keys.
   - Triangle groups derive slice/within ordering from `deriveParentTileRenderFields(parentTx, parentTy)`.
   - Parent-tile ownership is distinct from triangle base/admission tiles:
     - parent tile controls structure ownership and render ordering
     - base/admission tile controls visibility and semantic height sampling
   - Direct overlays derive slice ownership from their SE anchor tile and layer role.
   - These structure drawables are then consumed by `collectStructureDrawables()` for final render-command emission.

## Core Invariants

- Monolithic semantic geometry is keyed by skin id, sprite id, and flip state.
- Canonical monolithic building skins must source footprint and height data from semantic placement geometry; direct authored `w` / `h` / `heightUnits` access is intentionally blocked for those skins.
- `buildMonolithicBuildingSemanticGeometryFromAlphaMap()` returns `null` if anchor/bounds/work-rect derivation fails.
- Monolithic semantic geometry may be `source: "computed"` or `source: "fallback"`; downstream placement and footprint consumers use the semantic result either way.
- `getStructureSlices()` builds alternating 64px bands around the computed anchor and preserves slice order while widening only the outer edge bands.
- `collectRequiredMonolithicBuildingSkinIdsForMap()` only includes skins that are actually monolithic building definitions.
- `assertMonolithicBuildingSemanticPrepassComplete()` throws if required monolithic semantic geometry is missing.
- `resolveMonolithicFootprintTopLeftFromSeAnchor()` treats the overlay SE anchor plus semantic `n` / `m` as the authoritative footprint basis for parent-tile ownership.
- `resolveMonolithicSliceParentFootprintPosition()` is the single runtime helper for converting a monolithic band index into footprint-relative parent-tile ownership.
- `RuntimeStructureTriangleCacheStore` is context-keyed and stores caches by structure instance id.
- `RuntimeStructureTriangleCacheStore.get()` returns a cache only when the stored geometry signature matches the requested one.
- `markFallback(structureInstanceId)` removes any existing triangle cache for that structure and records explicit fallback state.
- `buildMonolithicStructureTriangleCacheForOverlay()` returns `null` when semantic geometry or projected runtime triangles are unavailable.
- Runtime structure triangles carry distinct tile roles:
  - `parentTx` / `parentTy` for ownership and render ordering
  - `admissionTx` / `admissionTy` and `cameraTx` / `cameraTy` for visibility/admission and semantic height logic
- `collectStructureOverlays()` sets `useRuntimeStructureSlicing` only for overlays with `layerRole === "STRUCTURE"`.
- `resolveStructureOverlayAdmissionContext()` always uses a map-wide overlay prefilter for structure overlays.
- In `hybrid` admission mode, a triangle must be both viewport-visible and render-distance-visible.
- `buildStructureDrawables()` derives triangle-group render ordering from parent tile ownership, not from raw triangle order.

## Design Constraints

- Structure topology for runtime slicing must remain derived from monolithic semantic geometry, not from ad hoc per-frame sprite heuristics, whenever semantic geometry exists.
- Parent-tile ownership, footprint bounds, and render-key derivation must remain centralized through the monolithic footprint helpers; do not duplicate ownership math in debug or render-call sites.
- `STRUCTURE` overlays must remain visibility-authoritative through runtime triangle admission; coarse overlay-rect culling must not replace triangle-level admission for those overlays.
- Runtime triangle ownership and render ordering must remain parent-tile based so structure slices sort consistently with the world grid, even when admission tiles differ from owner tiles.
- Geometry signatures must fully capture every placement/input change that affects structure topology; stale triangle caches must not be reused across semantic, placement, or context changes.
- Non-structure overlays and props must continue to use the direct-overlay path unless they explicitly become `STRUCTURE` overlays and this document is updated.

## Dependencies (In/Out)

### Incoming

- Monolithic building definitions from building content registries
- Sprite image readiness and image data from render-sprite loading
- Compiled-map overlays from the map compilation system
- Frame admission inputs from the render pipeline:
  - viewport tile bounds
  - render-distance checks
  - player camera tile
  - screen-space cutout rect
- Runtime structure-atlas frame access and merged-slice cache usage from neighboring presentation systems

### Outgoing

- Monolithic placement geometry used by map compile / structure placement paths
- Runtime structure triangle caches and parent-tile groups consumed by structure presentation code
- Structure slice pieces and structure drawables consumed by `collectStructureDrawables()`
- Semantic triangle info and resolved structural roof height data consumed by downstream shadow/presentation paths

## Extension Points

- Anchor extraction in `getStructureAnchorFromAlphaMap()`
- Slice-band generation in `getStructureSlices()`
- Triangle generation and alpha culling in `buildMonolithicSliceGeometry()` / `cullMonolithicTrianglesByAlphaWithDiagnostics()`
- Prepass lifecycle helpers:
  - `primeMonolithicBuildingSemanticPrepass()`
  - `computeMonolithicBuildingSemanticsForSkinIds()`
  - `getMonolithicBuildingSemanticPrepassStatus()`
- Runtime triangle cache build and context key helpers
- Admission modes and structure overlay admission rules
- Structure drawable key derivation in `buildStructureDrawables()`

## Failure Modes / Common Mistakes

- Missing monolithic semantic geometry at compile/load time causes required-geometry assertions or runtime fallback rather than valid structure slicing.
- Reusing a triangle cache after geometry-signature changes can attach the wrong topology to a structure instance.
- Treating all overlays as coarse rectangles can incorrectly cull visible `STRUCTURE` geometry that only triangle admission is meant to decide.
- Forcing props or non-`STRUCTURE` overlays through the monolithic slicing path can yield no valid triangle cache and unnecessary fallback churn.
- Skipping loading-time triangle preparation is legal, but it shifts work into render-time rebuilds and can increase first-frame structure work.
- Assuming legacy sprite placement is always the authoritative path is incorrect; computed semantic anchors override it for monolithic structures when available.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
