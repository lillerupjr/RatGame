# Agent Contract --- Backend-Neutral Renderer Transition for Future Full WebGL RatGame

## Goal

Transition RatGame from a Canvas-execution-driven renderer to a
backend-neutral render architecture that can later support a real WebGL
world renderer.

This phase is **not** the WebGL renderer implementation phase.

The target outcome is: - CPU remains authoritative for simulation and
render extraction - frame is typed render data, not Canvas closures -
rendering backends become swappable - Canvas2D remains parity backend -
WebGL can later be added cleanly

------------------------------------------------------------------------

## Locked Design

### Responsibility Split

CPU: - world state, ECS, simulation - render extraction, sorting, passes

Renderer: - consumes render frame - executes draw commands

------------------------------------------------------------------------

### Migration Strategy

Stage A: Contract + Canvas parity\
Stage B: WebGL backend

Do NOT combine.

------------------------------------------------------------------------

### Architectural Direction

Replace: - drawFn closures

With: - typed render commands

------------------------------------------------------------------------

### Pass Ownership

Explicit passes: - GROUND - WORLD - SCREEN

------------------------------------------------------------------------

## Implementation Steps

### A. Drawable Audit

Classify drawables into: - sprite - decal - triangle - primitive -
light - overlay - debug

------------------------------------------------------------------------

### B. Render Contract

Introduce: - RenderFrame - RenderCommand

No Canvas or WebGL in contract.

------------------------------------------------------------------------

### C. Explicit Frame

Frame contains: - ground - world - screen

------------------------------------------------------------------------

### D. Replace Closures

Convert collectors to emit commands.

Order: 1. ground 2. entities 3. vfx 4. overlays 5. lights 6. structures
7. debug

------------------------------------------------------------------------

### E. Canvas Backend

Implement Canvas2DRenderer using commands.

------------------------------------------------------------------------

### F. Parity Check

Ensure visuals match current system.

------------------------------------------------------------------------

### G. WebGL Backend (later)

Start with: - sprites - decals - transforms - blending

------------------------------------------------------------------------

## Constraints

-   Do NOT use Phase 1 branch as base
-   Do NOT change ordering logic
-   Do NOT move simulation into renderer
-   Do NOT optimize yet

------------------------------------------------------------------------

## Deliverables

1.  Drawable mapping
2.  Render contract
3.  Frame structure
4.  Command extraction
5.  Canvas backend
6.  Parity checkpoint

------------------------------------------------------------------------

## Progress Snapshot

Stage A status:
-   [x] Drawable mapping exists in `docs/rendering/renderer_command_inventory.md`
-   [x] `RenderFrame` and `RenderCommand` exist as backend-neutral contracts
-   [x] Frame structure is explicit: `ground`, `world`, `screen`
-   [x] Main renderer pipeline no longer uses `drawFn`
-   [x] Collectors emit typed commands into a frame builder
-   [x] `Canvas2DRenderer` consumes the frame and owns main-canvas draw execution
-   [x] World ordering logic remains CPU-owned
-   [ ] Full visual parity audit is still open

Stage B status:
-   [x] Shared execution planning now linearizes CPU-owned draw order before backend execution
-   [x] `renderBackend: "canvas2d" | "webgl"` exists in the settings pipeline and Graphics UI
-   [x] A sibling `#c-webgl` world canvas is managed at bootstrap; `#c` remains the Canvas2D fallback/menu/loading surface
-   [x] `WebGLRenderer` exists as a real backend consuming `RenderFrame` commands
-   [x] Mixed-backend routing avoids double-draw: supported commands go to WebGL, unsupported commands fall back to Canvas2D
-   [x] Backend/per-frame fallback counts are visible through existing render perf debug reporting
-   [x] Initial WebGL textured-quad support exists for `imageSprite`, flat `imageTop`, and quad-safe `renderPieceSprite`
-   [x] Ground surfaces and ground decals now emit normalized projected-surface payloads
-   [ ] Lights, shadows, structure triangles, debug passes, and most entity sprite variants still fall back to Canvas2D
-   [ ] Live browser parity audit for the WebGL path is still open

Stage C status:
-   [x] An explicit capability matrix now classifies active command families as `WEBGL_READY`, `WEBGL_PORT_NEXT`, `CANVAS_FALLBACK`, and staged deferred buckets
-   [x] Backend debug visibility now reports per-family WebGL, Canvas fallback, unsupported, and partially handled counts
-   [x] WebGL support expanded beyond the Stage B textured-quad subset
-   [x] `primitive:zoneEffect` is now supported in WebGL for non-`FIRE` zone kinds; `FIRE` remains an explicit Canvas fallback
-   [x] `overlay:screenTint` and `overlay:ambientDarkness` now render through WebGL
-   [x] `overlay:structureOverlay` now renders through WebGL when it resolves to a quad-safe piece draw
-   [x] `light:projectedLight` now renders through WebGL using existing projected/additive light semantics
-   [ ] Runtime sidewalk/decal tops still fall back to Canvas2D
-   [ ] Structure triangle groups, shadow-heavy systems, debug rendering, text/path primitives, and most legacy entity sprite variants remain deferred
-   [ ] Live browser parity audit for Stage C WebGL coverage is still open

Stage D status:
-   [x] An explicit Stage D deferred-family matrix exists with family-level disposition and reason notes
-   [x] `triangle:structureTriangleGroup` now routes through WebGL by default
-   [x] Structure triangle groups render as real textured triangles in `WebGLRenderer`
-   [x] Structure triangle cutout alpha behavior is preserved in the WebGL path
-   [x] Compare-distance structure-triangle visualization is now split into `debug` commands instead of a geometry fallback sidepath
-   [x] Backend routing/tests no longer treat `worldGeometry:triangles` as partially handled because of debug-only geometry subpaths
-   [ ] Shadow-heavy systems, debug rendering, text/path primitives, and most legacy entity sprite variants still remain outside WebGL
-   [ ] Live browser parity audit for Stage D hard-geometry coverage is still open

Stage E status:
-   [x] A final backend matrix now classifies every active command family and documents current route, parity status, and release-default acceptability
-   [x] Backend-default policy is explicit: `Canvas2D` remains the default world backend and `WebGL` remains opt-in
-   [x] WebGL init/runtime failure now falls back to Canvas2D explicitly and remains debug-visible
-   [x] Render perf/debug output now shows requested backend, selected backend, default policy, and fallback reason
-   [x] Runtime ambiguity around remaining Canvas families is reduced to explicit intentional/deferred/blocking buckets
-   [ ] WebGL is still **not** signed off as the default backend
-   [ ] Exact blockers now live in mixed canonical families: `worldSprite:quad` and `worldPrimitive:primitive`
-   [ ] Final manual/live parity audit is still open

Current known boundary:
-   Structure slice building still receives a Canvas context for debug-prep work during extraction; draw execution remains backend-owned
-   Stage E finalizes policy, but fallback coverage is still intentional and not parity-complete
-   `primitive:zoneEffect` is intentionally partial in Stage C: non-`FIRE` variants route to WebGL, `FIRE` stays on Canvas2D fallback
-   `worldGeometry:triangles` is fully normalized in Phase 2; compare-distance overlays now live under `debug`
-   Final Stage E backend policy is explicit: WebGL is a supported opt-in backend, but not the default backend yet
-   Blocking signoff families are explicit: `worldSprite:quad` and `worldPrimitive:primitive`
-   Intentional/deferred Canvas families are explicit in `docs/rendering/ratgame_renderer_final_backend_matrix.md`

Current verification completed:
-   `npm run typecheck`
-   `npm run build`
-   `npm run test -- src/tests/game/systems/presentation/worldRenderOrdering.test.ts`
-   `npm run test -- src/tests/game/systems/presentation/renderExecutionPlan.test.ts src/tests/game/systems/presentation/renderBackendRouting.test.ts src/tests/game/systems/presentation/renderBackendSelection.test.ts src/tests/game/systems/presentation/WebGLRenderer.test.ts src/tests/settings/settingsBuckets.test.ts src/tests/ui/pause/pauseMenu.test.ts`
-   `rg -n "drawFn" src`

------------------------------------------------------------------------

## Acceptance Criteria

-   No drawFn in pipeline
-   Frame is backend-neutral
-   Canvas backend works
-   Architecture ready for WebGL

------------------------------------------------------------------------

## Branch Strategy

Branch A: contract + Canvas\
Branch B: WebGL backend

------------------------------------------------------------------------

## End
