# Canonical Render Phase 2 Contract

## Status

Phase 2 is implemented for the hard-contract families:

- `groundSurface / projectedSurface`
- `groundDecal / projectedSurface`
- `worldGeometry / triangles`

Active guarantees from this phase:

- `groundSurface` emits one normalized projected-surface payload shape only
- `groundDecal` emits one normalized projected-surface payload shape only
- `worldGeometry` emits explicit triangle meshes only
- aprons are reclassified to `worldGeometry / triangles`
- compare-distance geometry overlays are emitted as `debug`, not embedded in geometry payloads
- Canvas2D and WebGL consume the same normalized payload structures for these families

Phase 2 does not standardize `worldSprite`, `worldPrimitive`, `screenOverlay`, or general `debug` payloads beyond the geometry-debug spillover needed here.

## Locked Phase 2 Outcomes

### `groundSurface / projectedSurface`

Strict payload:

- `image`
- `sourceWidth`
- `sourceHeight`
- `triangles`

Rules now enforced:

- exactly 2 triangles per command
- no rect payloads
- no runtime helper descriptors
- no backend-time ground projection

Covered emitters:

- authored flat floor tops
- runtime sidewalk tops
- ocean tops
- ramp-road ground surfaces

### `groundDecal / projectedSurface`

Strict payload:

- `image`
- `sourceWidth`
- `sourceHeight`
- `triangles`

Rules now enforced:

- exactly 2 triangles per command
- decals are embedded into tile-diamond canvases before emission
- no `setId`/`variantIndex`/rotation metadata survives in emitted commands
- no backend-time flat/projected decision remains

Covered emitters:

- runtime road/decal markings on flat tiles
- runtime road/decal markings on ramp tiles

### `worldGeometry / triangles`

Strict payload:

- `image`
- `sourceWidth`
- `sourceHeight`
- `triangles`

Rules now enforced:

- no `draw` payload survives in emitted commands
- no backend flip resolution
- no backend cutout-alpha computation
- no compare-distance debug data embedded in geometry payloads

Covered emitters:

- aprons
- walls
- occluders
- roof/structure direct overlays
- existing structure triangle groups

## Implemented Changes

### Contract and shared normalization

Implemented:

- explicit normalized triangle records with `srcPoints`, `dstPoints`, and resolved `alpha`
- fixed projected-surface triangle-pair payloads for ground families
- shared CPU normalization helpers for:
  - tile-diamond destination geometry
  - rectangle-to-triangle geometry
  - cutout alpha resolution

### Collector normalization

Implemented in collectors:

- all ground tops now emit normalized projected surfaces
- all ground decals now emit normalized projected surfaces
- aprons now emit `worldGeometry / triangles`
- wall/roof/occluder direct draws are converted to triangle meshes before command creation
- structure compare-distance overlays are emitted as debug triangle overlays

### Backend consumption and policy

Implemented:

- Canvas2D ground/geometry rendering now runs through triangle-mesh execution only
- WebGL ground/geometry rendering now runs through triangle-mesh execution only
- backend routing no longer treats geometry as partially handled because of draw/debug subpaths
- ground families are no longer blocked because of non-canonical payload forms
- default-backend signoff remains deferred because mixed `worldSprite` and `worldPrimitive` families still block Phase 3 policy completion

## Acceptance Checklist

- [x] every `groundSurface` command has exactly 2 triangles
- [x] every `groundDecal` command has exactly 2 triangles
- [x] no emitted `groundSurface` payload uses rect/descriptive fields
- [x] no emitted `groundDecal` payload uses descriptor fields
- [x] every `worldGeometry` command uses explicit triangles
- [x] aprons emit `worldGeometry / triangles`
- [x] compare-distance overlays emit as `debug`
- [x] Canvas2D and WebGL accept the same normalized ground/geometry payloads
- [x] backend routing no longer relies on geometry draw fallback
- [x] ground families are no longer blocked for Phase 2 form-gap reasons
- [ ] full live/manual parity audit remains open
- [ ] Phase 3 backend cleanup remains open

## Verification Notes

Verified in this implementation pass with:

- `npm run typecheck`
- targeted presentation tests:
  - `src/tests/game/systems/presentation/renderExecutionPlan.test.ts`
  - `src/tests/game/systems/presentation/renderBackendRouting.test.ts`
  - `src/tests/game/systems/presentation/renderBackendSelection.test.ts`
  - `src/tests/game/systems/presentation/WebGLRenderer.test.ts`

## Remaining Phase 3 Work

Still deferred:

- deletion of dead backend helper branches
- default-backend signoff cleanup
- sprite payload normalization
- primitive payload normalization
- broader screen/debug payload cleanup
