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
