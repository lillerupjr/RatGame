# Structure Geometry / Slicing System

## Purpose

Own monolithic structure semantic geometry, runtime triangle caches, overlay admission, triangle-group slicing, and structure drawable derivation before final render submission.

## Scope

- Semantic prepass: `src/game/structures/monolithicBuildingSemanticPrepass.ts`, `getStructureAnchor.ts`, `getStructureSlices.ts`, `buildMonolithicDebugSliceTriangles.ts`
- Runtime geometry/triangle cache: `src/game/structures/monolithicStructureGeometry.ts`
- Overlay admission/candidates/slices/drawables: `src/game/systems/presentation/structures/structureOverlayAdmission.ts`, `collectStructureOverlays.ts`, `buildStructureSlices.ts`, `buildStructureDrawables.ts`, `structurePresentationTypes.ts`
- Triangle semantics: `src/game/systems/presentation/structureShadows/structureTriangleSemantics.ts`
- Loading-time preparation and render-time rebuild triggers in `src/game/game.ts`, `src/game/systems/presentation/render.ts`

## Non-scope

- Map activation outside semantic-prepass dependency: `docs/canonical/map_compilation_activation_floor_topology.md`
- Atlas stores, merged-slice cache storage, ground cache: `docs/canonical/atlas_render_cache_system.md`
- Final ordering/backend submission: `docs/canonical/presentation_rendering_pipeline.md`
- Shadow orchestration/masks/lighting: `docs/canonical/shadow_lighting_system.md`
- Generic non-structure overlay rendering paths

## Entrypoints

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

## Pipeline

1. **Semantic Prepass**: canonical monolithic skins are authored as identity + sprite path via `makeMonolithicBuilding()`. Direct reads of authored `w`, `h`, `heightUnits` are blocked; placement geometry comes from semantic prepass. Required skin ids come from `collectRequiredMonolithicBuildingSkinIdsForMap()`. `computeMonolithicBuildingSemanticsForSkinIds()` / `primeMonolithicBuildingSemanticPrepass()` compute or provide fallback semantic geometry per skin/sprite/flip.
2. **Semantic Geometry Build**: `buildMonolithicBuildingSemanticGeometryFromAlphaMap()` derives anchor/occupied bounds from alpha, work rect/local anchor, alternating bands via `getStructureSlices()`, zig-zag triangles via `buildMonolithicSliceGeometry()`, alpha-culls triangles, derives footprint `n`/`m`, parent-footprint offsets, and height units. If unavailable, fallback comes from `MONOLITHIC_BUILDING_SEMANTIC_PLACEMENT_FALLBACK`.
3. **Validation / Access**: map activation calls `assertMonolithicBuildingSemanticPrepassComplete()` before compiling maps needing monolithic semantics. Runtime access uses `getMonolithicBuildingSemanticGeometryForSprite()`, required variants, and placement helpers; missing required geometry throws instead of fabricating topology.
4. **Overlay Resolution**: runtime overlays carry `monolithicSemanticSkinId`, `monolithicSemanticSpriteId`, `seTx`, `seTy`. `resolveMonolithicStructureGeometryForOverlay()` and footprint helpers recover semantic geometry/tile bounds. `buildRuntimeStructureProjectedDraw()` computes no-camera projected placement using semantic anchor when available, else legacy fallback.
5. **Triangle Cache**: `buildMonolithicStructureTriangleCacheForOverlay()` builds a geometry signature from structure id, sprite id, semantic key, anchor tile, footprint, flip, draw placement, sprite dimensions, slice offsets, z; converts semantic triangles to projected runtime triangles; assigns parent-tile ownership, semantic sides, height-from-parent; groups by parent tile. `RuntimeStructureTriangleCacheStore` caches by structure instance id and validates signature. Loading precomputes map-wide; `render.ts` rebuilds on context-key changes.
6. **Admission / Collection**: `resolveStructureOverlayAdmissionContext()` derives frame admission. For `STRUCTURE`, map-wide overlay prefilter remains, but triangle visibility is authority. `collectStructureOverlays()` filters overlays, resolves placement, and marks runtime slicing.
7. **Slices / Drawables**: `buildStructureSlices()` obtains/rebuilds caches for runtime-sliced overlays, filters visible triangle groups by `viewport`, `renderDistance`, `hybrid`, or `compare`, applies semantic triangle info, updates roof height if needed, and emits parent-tile-owned `triangleGroup` slices. Fallback/direct overlays emit direct slice pieces. `buildStructureDrawables()` converts pieces into stable render keys; triangle groups use `deriveParentTileRenderFields(parentTx, parentTy)`. Parent tile controls ownership/order; base/admission tile controls visibility and height sampling.

## Invariants

- Monolithic semantic geometry key = skin id + sprite id + flip.
- Monolithic building footprint/height comes from semantic placement geometry, not authored dimensions.
- Alpha-map semantic build returns `null` if anchor/bounds/work-rect derivation fails.
- Semantic geometry may be `computed` or `fallback`; consumers use either.
- `getStructureSlices()` builds alternating 64px bands around computed anchor, preserving order while widening outer bands.
- Required semantic prepass throws when geometry is missing.
- SE anchor + semantic `n`/`m` is authoritative footprint basis for parent ownership.
- `resolveMonolithicSliceParentFootprintPosition()` is the runtime band-index -> parent-footprint helper.
- Triangle cache returns only on matching geometry signature; `markFallback(...)` removes cache and records fallback.
- Runtime triangles have distinct roles: `parentTx`/`parentTy` for ownership/order; `admissionTx`/`admissionTy` and `cameraTx`/`cameraTy` for visibility/height.
- Runtime slicing applies only to overlays with `layerRole === "STRUCTURE"`.
- Structure overlay prefilter is map-wide; `hybrid` admission requires viewport and render-distance visibility.
- Triangle-group render ordering derives from parent tile, not raw triangle order.

## Constraints

- Runtime slicing topology derives from monolithic semantic geometry, not per-frame sprite heuristics, when semantic geometry exists.
- Parent-tile ownership, footprint bounds, and render-key math stay centralized in monolithic helpers.
- `STRUCTURE` visibility authority is runtime triangle admission; coarse rect culling cannot replace it.
- Geometry signatures must capture every topology-affecting input.
- Non-structure overlays/props stay direct unless they explicitly become `STRUCTURE` overlays and this doc changes.

## Dependencies

### Incoming

- Monolithic building definitions
- Sprite readiness/image data from render-sprite loading
- Compiled-map overlays
- Frame admission inputs from render pipeline: viewport bounds, render-distance checks, player camera tile, cutout rect
- Runtime structure-atlas frame access and merged-slice cache from presentation neighbors

### Outgoing

- Monolithic placement geometry for map compile / structure placement
- Runtime triangle caches and parent-tile groups for structure presentation
- Structure slice pieces/drawables for `collectStructureDrawables()`
- Semantic triangle info and roof height for downstream shadow/presentation paths

## Extension

- Anchor extraction in `getStructureAnchorFromAlphaMap()`
- Slice bands in `getStructureSlices()`
- Triangle generation/alpha culling in `buildMonolithicSliceGeometry()` / `cullMonolithicTrianglesByAlphaWithDiagnostics()`
- Prepass lifecycle helpers and status
- Runtime triangle cache build/context keys
- Admission modes/rules
- Drawable key derivation in `buildStructureDrawables()`

## Failure Modes

- Missing semantic geometry causes assertions or fallback, not valid slicing.
- Reusing cache after signature changes attaches wrong topology.
- Coarse-rect culling can hide visible `STRUCTURE` triangles.
- Forcing props/non-`STRUCTURE` overlays into monolithic slicing causes fallback churn.
- Skipping loading-time triangle prep is legal but shifts work to first render frames.
- Assuming legacy placement is authoritative ignores computed semantic anchors.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
