# Renderer Decomposition Contract — RatGame

## Final Pass — Stage 2: Hard Extraction & Purification

### Goal
Remove all remaining embedded subsystems from `src/game/systems/render.ts` and finalize it as a pure frame conductor.

This phase completes the transition from:
"partially cleaned renderer"
to:
"strict orchestration layer"

---

## Problem Statement

Even after Phase 1–3 and the initial final pass, `render.ts` still contains:

- V5/V6 structure shadow implementation logic
- triangle affine + textured triangle rendering primitives
- remaining debug overlay calls
- large multi-hundred-line functions that implement subsystem behavior

These are **hidden subsystems** and must be removed.

---

## Required Extraction Targets

### 1. Structure Shadow V6 Implementation

Create:

src/game/systems/presentation/structureShadows/
- structureShadowV6Slices.ts

Move OUT of render.ts:
- buildStructureV6FaceSliceDebugData
- buildStructureV6VerticalShadowMaskDebugData
- all slice/axis/mask math
- all V5/V6 debug slice data types

Rules:
- render.ts must not know how slicing works
- render.ts must not perform mask composition

---

### 2. Triangle Rendering Primitives

Create:

src/game/systems/presentation/renderPrimitives/
- triangleAffine.ts
- drawTexturedTriangle.ts

Move:
- computeTriToTriAffine
- drawTexturedTriangle
- drawShadowTexturedTriangle

Rules:
- these are shared low-level primitives
- must be reusable across triangles, shadows, and future systems

---

### 3. Complete Debug Extraction

Move remaining debug functions out of render.ts:

- drawStructureV65MergedShadowMaskInWorld → debug/renderDebugStructures.ts
- drawEntityAnchorOverlay → debug/renderDebugEntities.ts

Ensure:
- render.ts only calls `executeDebugPass`
- no direct debug drawing remains

---

### 4. Eliminate Large Local Functions

Rule:

Any function in render.ts:
- longer than ~100 lines
- or performing geometry/mask/slice logic

→ MUST be moved out

---

## Locked Rules

### Rule A — render.ts is orchestration ONLY

Allowed:
- calling subsystems
- pass ordering
- frame lifecycle

Forbidden:
- triangle math
- slice math
- mask building
- per-pixel logic
- canvas scratch orchestration for subsystems

---

### Rule B — No Hidden Subsystems

If a function:
- builds geometry
- transforms pixels
- performs slicing
- handles masks

It belongs OUTSIDE render.ts.

---

### Rule C — No New Dump Files

Do NOT create:
- renderUtils.ts
- renderHelpers.ts

Every file must have strict ownership.

---

### Rule D — Behavior Preservation

Do NOT change:
- shadow appearance
- triangle mapping
- debug output
- ordering
- pass order

---

## Target End-State

render.ts should look conceptually like:

```
render(world, ctx) {
  frame = buildFrameContext(world)

  prepareSubsystems(frame)

  selection = collectVisible(frame)
  geometry = buildGeometry(frame, selection)
  ordered = sortDrawables(geometry)

  drawGround(ctx, ordered)
  drawWorld(ctx, ordered)
  drawShadows(ctx, ordered)
  drawLighting(ctx, ordered)

  if (frame.debug.enabled) {
    executeDebugPass(ctx, frame)
  }
}
```

---

## Acceptance Criteria

### Structural
- render.ts contains no V5/V6 shadow logic
- render.ts contains no triangle rendering primitives
- render.ts contains no debug drawing helpers
- no large subsystem functions remain

### Behavioral
- no visual change
- no shadow change
- no ordering change
- debug behavior unchanged

### Code Quality
- render.ts reads like a pipeline
- subsystem ownership is obvious
- imports clearly indicate architecture

---

## Anti-Drift Rules

Do NOT:
- partially move logic
- duplicate logic across modules
- refactor algorithms during extraction

Do:
- move code cleanly
- keep modules focused
- preserve behavior first

---

## Deliverable

Return:
1. changed files
2. list of extracted functions
3. list of remaining large functions (if any)
4. confirmation render.ts is orchestration-only

---

## Principle

Final transformation:

From:
"render.ts still hides subsystems"

To:
"render.ts is a clean, readable conductor of independent systems"
