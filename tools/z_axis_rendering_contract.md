# Z-Axis Usage & Rendering Contract (Canvas2D)

> **Purpose**  
> Define a stable Z-axis contract for gameplay, rendering, and occlusion in an isometric Canvas2D engine.  
> This document is written for use by an LLM inside an IDE.

> **Rule**  
> **Do NOT write time-gated comments** (e.g. “later we will…”).  
> Write **contract-style documentation only**.

---

## Implementation Order (Hard Contract)

1. Implement this Z-axis contract first (types + helpers + invariants).  
2. Implement render pipeline changes second.

The renderer must not invent Z semantics.

---

## Core Takeaways

### 1) Z Is Semantic, Not Geometric
- Z encodes meaning (floors, overlap, occlusion), not real 3D physics.
- There is no Z-buffer in Canvas2D.

### 2) Visibility Is Solved with Occluders + Passes
- Projection math does not solve overlap.
- Correctness comes from:
  - explicit occluders (curtains)
  - stable render passes
  - consistent depth rules

### 3) Footpoint Depth Is Authoritative
- Entities are ordered by their **ground contact point**.
- Sprite top/center must never drive ordering.

---

## Required Z Roles

Z must not be overloaded. The following conceptual roles are distinct:

### 1) Logical Z (`zLogical`)
- Discrete floor/platform identifier.
- Used for:
  - gameplay rules
  - active-floor selection
  - AI reasoning

### 2) Visual Z (`zVisual`)
- Continuous height used for rendering and effects.
- Includes ramp interpolation or offsets.
- Must never dominate screen-depth ordering.

### 3) Occlusion Z (`zOcclusion`)
- Determines whether something can hide something else.
- Curtains and walls are authoritative occluders.
- Tiles are not authoritative occluders.

These values may share data but must not share logic.

---

## Stacked Surfaces Agreement

The world supports multiple walkable Surfaces at the same (x,y) with different Z.

Contract:
- `(x,y)` does not identify a single tile.
- A compiled map stores **Surface instances** grouped by `(x,y)`.

Required queries:
- `surfacesAtXY(tx, ty): Surface[]`
- `surfaceAtWorld(wx, wy, hintZ?: number): Surface | null`
- `surfaceBelow(wx, wy, z: number): Surface | null`
- `surfaceAbove(wx, wy, z: number): Surface | null`

**Rule:** any “heightAt” API must accept a `hintZ` or return a Surface handle.

---

## Surface Selection Rules

Surface selection is a contract, not a heuristic scattered across systems.

### Entities (movement)
- Entities maintain `zLogical` and `zVisual`.
- When updating movement/collision:
  - choose a Surface using `surfaceAtWorld(wx, wy, hintZ = entity.zVisual)`
  - update `entity.zVisual = chosenSurface.zBase + localOffset`

### Projectiles / effects
- Define explicit rules:
  - “first surface below” (gravity / drop tests)
  - “surface at my z” (on-floor effects)
  - “line-of-floor” checks use Surface handles, not raw height values

---

## Continuous Z Principle

- Authoring may remain discrete.
- Runtime Z is continuous.

Example:
```ts
entity.zVisual = surface.zBase + rampOffset
```

---

## Rendering Depth Contract

Rendering uses a single canonical depth value:

```ts
renderDepth =
  screenY
  + screenX * EPSILON_X
  + zVisual * EPSILON_Z
  + stableId * EPSILON_ID
```

Rules:
- `screenY` is always dominant
- Z only breaks ties
- no “higher floor always on top” dominance is allowed

---

## Curtains as Z Authorities

- Curtains define occlusion truth.
- Curtains include a vertical span: `[zFrom, zTo]`.
- Walls are tall curtains.

Renderer rules:
- curtains render after entities
- curtains may cover entities freely
- renderer must not inspect tile kinds

---

## Visibility Policy Contract

Visibility is a policy layer, not a render hack.

Allowed policies:
- active-floor-only rendering (by `zLogical`)
- dimming non-active floors
- fade-through above/below player

Policies apply to TOPS and CURTAINS.

---

## Camera Compatibility Constraints

Current system:
- explicit iso projection
- camera expressed as offset + zoom

Constraints:
- all renderables project through a single function
- depth keys are derived from projected coordinates
- no gameplay logic depends on camera orientation

This guarantees clean integration with a future camera matrix or WebGL renderer.

---

## Explicit Non-Goals

- No per-pixel depth testing
- No real 3D physics
- No camera matrix implementation
- No dynamic occlusion generation

---

## Mental Model (Contract)

> **Z decides what exists.**  
> **Screen-Y decides what is in front.**  
> **Curtains decide what hides.**

All engine code must respect this separation.

---

## Definition of Done

This Z-axis contract is correctly applied when:

- Z roles are explicit (`zLogical`, `zVisual`, `zOcclusion`)
- stacked surfaces are selectable via query helpers
- height/occlusion queries do not assume “one tile per (x,y)”
- renderer consumes Z through helpers, not through tile inspection

---

## Achievements (Implemented)

- Surface model added (`Surface`) with `(tx,ty)->Surface[]` indexing
- Query helpers added (`surfacesAtXY`, `surfaceAtWorld`, `surfaceBelow`, `surfaceAbove`, `surfaceHitAtWorld`)
- `heightAtWorld` accepts a `hintZ` and resolves to a surface hit when provided
- `walkInfo` exposes `zLogical` + `zVisual` and selects surfaces using an optional `hintZ`
- Occlusion scans use surface lists instead of assuming one tile per `(x,y)`
- `zOcclusion` is explicit and visibility queries route through it
- Entity state includes `zLogical` + `zVisual` (player/enemy/projectile)
- Entity ordering uses the render-depth formula (screenY + screenX*EPS + zVisual*EPS + stableId*EPS)
- Renderer consumes surface helpers for layer selection and top/apron drawing

---

## Next Contract Work

- Apply the render-depth formula to tile tops if per-surface sorting is required beyond diagonal scan order
