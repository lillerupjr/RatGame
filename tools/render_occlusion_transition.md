# Render & Occlusion Transition Plan (Canvas2D, Curtain-Based)

> **Purpose**  
> Transition the renderer to a stable, debuggable pipeline that supports overlapping floors and multi-height occlusion in an isometric Canvas2D engine.  
> This document is written for use by an LLM inside an IDE.

> **Rule**  
> **Do NOT write time-gated comments** (e.g. “later we will…”).  
> Write **contract-style documentation only**.

---

## Implementation Order (Hard Contract)

1. **Z-axis contract first** (types + query helpers + invariants)  
2. **Render pipeline second** (TOPS → ENTS → CURTAINS, instance-driven)

The renderer must not define Z semantics. It consumes them.

---

## Core Decision

- Stay on **Canvas2D**
- Use **layered rendering as semantic passes**, not height dominance
- Formalize **curtains (occluders)** as first-class compiled map data
- Support **stacked surfaces**: multiple walkable surfaces at the same (x,y) with different Z
- Keep **camera matrix** out of scope, but enforce projection APIs that integrate cleanly with one

---

## Authoritative World Model

### 1) Surfaces (TOPS)
Static walkable surfaces that entities stand on.

A **Surface** has:
- `xyKey` (tile or world anchor)
- `zBase` (continuous)
- `zLogical` (discrete floor/platform id)
- walkability flags
- top sprite reference
- screen projection derived via the projection API

**Stacking is supported:** multiple Surfaces may share the same `xyKey`.

### 2) Occluders (CURTAINS)
Static vertical faces that hide things behind them.

A **Curtain** has:
- an anchor `xyKey` and a face direction
- `zFrom` and `zTo` (vertical span)
- sprite reference (including flip flags if needed)
- screen projection derived via the projection API

Curtains:
- are **purely visual**
- do not affect gameplay logic
- are generated at **map compile time**

### 3) Entities (ENTS)
Dynamic actors (player/enemies/projectiles).

Entities:
- have a **footpoint** in world
- have `zVisual` (continuous) derived from the Surface they occupy
- derive render depth from projected footpoint

Entities are never sorted by sprite top.

---

## Rendering Pipeline (Mandatory)

Rendering is performed every frame in the following passes:

1. **TOPS pass**
   - draw visible Surface tops
   - sort by screen-space depth (screenY primary)

2. **ENTITIES pass**
   - draw entities / projectiles / pickups
   - sort by footpoint screen-space depth

3. **CURTAINS pass**
   - draw occluders last
   - sort by screen-space depth
   - curtains are allowed to cover entities

4. **FX / HUD pass**
   - screen-space effects only

This order is a hard contract.

---

## Depth & Sorting Rules

Sorting uses a single canonical key:

- **Primary:** screenY
- **Secondary:** screenX
- **Tertiary:** zVisual (tie-break only)
- **Final:** stable ID

Height must **never** dominate screen depth ordering.

---

## Stacked Surfaces: Required Queries

The compiled map must support multiple Surfaces per (x,y).

Required helpers (signatures are illustrative):
- `surfacesAtXY(tx, ty): Surface[]`
- `surfaceAtWorld(wx, wy, hintZ?: number): Surface | null`
- `surfaceBelow(wx, wy, z: number): Surface | null`
- `surfaceAbove(wx, wy, z: number): Surface | null`

**Rule:** any function that returns “the height at (x,y)” must accept a **hint Z** or an explicit Surface selection strategy.

---

## Curtain Generation Rules (Surface-Based)

Curtains are generated once when a map is compiled.

For each Surface `S` at `(x,y,zBase)` and each cardinal edge:
1. Find neighbor stack at `(x+dx, y+dy)`.
2. Select neighbor Surface `N` that best matches `S` in Z:
   - choose the highest `N.zBase` such that `N.zBase <= S.zBase` when possible
   - otherwise choose the lowest `N.zBase` above `S` (or treat as missing)
3. If `N` is missing or `N.zBase < S.zBase`, emit a Curtain spanning `[N.zBase, S.zBase]` (or `[0, S.zBase]` for void).
4. Stair/connector faces emit their own curtains according to the stair direction contract.

Renderer must never inspect tile kinds to decide curtains.

---

## Active Floor Visibility

An active-floor policy is a **visibility policy**, not a render hack.

- When filtering is enabled:
  - TOPS and CURTAINS are filtered by `zLogical` (active floor) or by a defined neighborhood policy
  - ENTS remain dynamic, but their Surface selection uses `hintZ` or `zLogical` rules

---

## Camera Integration Constraints (Future-Safe)

Current system:
- explicit iso projection
- camera expressed as offset + zoom

Constraints:
- all renderables project via a **single projection function**
- depth keys are derived from projected coordinates + small tie-breaks
- no gameplay logic depends on camera orientation

This guarantees clean integration with a future camera matrix or WebGL renderer.

---

## Full Wall Implementation (Curtain-Based)

Walls are implemented as **occluders** (CURTAINS) with vertical span. A wall is not a gameplay tile; it is compiled geometry.

### Wall Data Contract

A **WallSegment** is a Curtain instance with:

- `xyKey` (tile edge anchor, e.g. between (tx,ty) and neighbor)
- `faceDir` in {N,E,S,W}
- `zFrom` (bottom of wall)
- `zTo` (top of wall)
- `skinTop` / `skinMid` / `skinBase` (or a single sprite + repeat rules)
- `flipX` (if required by atlas conventions)
- `isSolid` (optional, for collision systems; rendering does not require this)

Walls may span multiple floors. The renderer treats them identically to other curtains.

### Wall Compilation Rules

Walls are generated at map compile time from one of the following sources:
- explicit wall tokens/metadata (preferred)
- derived from height differences (cliffs) when configured
- connector metadata (stairs/ramps) when configured

Compilation produces **one or more** segments per edge:
- If `zTo - zFrom` exceeds the height of a single wall sprite, emit stacked segments (base + mid repeats + top cap).
- Segment boundaries are multiples of your chosen wall unit (e.g. 1 height, 2 height, or “one floor”).

### Wall Rendering Rules

Walls are rendered in the **CURTAINS pass**:

- Walls sort using the same depth key contract (screenY primary).
- Walls may cover entities and lower floors.
- Wall sprites may be drawn as multiple stacked images; each stacked image inherits the same edge anchor and depth ordering.

Renderer rules:
- The renderer never inspects tile kinds or wall tokens.
- The renderer consumes compiled `WallSegment` Curtain instances only.

### Minimal Asset Requirements

Support either:
- `WALL_CAP`, `WALL_MID`, `WALL_BASE` sprites, or
- a single `WALL` sprite + repeat rule

The compilation step chooses how many segments to emit based on `[zFrom, zTo]`.


---

## Explicit Non-Goals

- No true Z-buffer
- No per-pixel depth correctness
- No real 3D physics
- No camera matrix implementation in this phase

---

## Definition of Done

This transition is complete when:

- Renderer consumes only compiled **Surface** and **Curtain** instances
- No stair/height special cases exist in render code
- Overlapping floors occlude correctly via Curtains
- Stacked surfaces are selectable by `hintZ` (entities, projectiles, queries)
- Render order bugs do not require ad-hoc depth offsets

---

## Achievements (Implemented)

- Z-axis contract implemented (Surface model + query helpers + z roles)
- Visibility routes through explicit `zOcclusion`
- Entities/projectiles use canonical render-depth ordering (screenY + screenX*EPS + zVisual*EPS + stableId*EPS)
- Renderer consumes surface helpers for layer selection and top/apron placement
- TOPS pass uses per-surface depth sorting
- Curtains are compiled at map build time and renderer consumes compiled instances
- Render metadata (anchors/offsets/dirs) is compiled into Surface/Curtain records
- Wall tokens supported (`W<height><dir>`), compiled into wall curtain segments using wall sprites

---

## Transition Work (Active)

- Validate wall placement with sample tokens in maps
