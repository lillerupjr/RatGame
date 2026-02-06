# Floor Aprons → Edge Walls Transition Plan

> **Instruction to LLM**
>
> * No time-gated comments
> * Contract-style documentation only
> * This document is linear and complete
> * Each section represents a locked architectural step
> * Achievements record completed invariants

---

## Purpose

Unify all vertical visual occlusion (floor edges, cliffs, walls, stairs) under a **single occluder (wall) system**, eliminating the separate concept of *floor aprons*.

This transition prioritizes:

* Engine simplicity
* Deterministic depth ordering
* Multi-height correctness
* Long-term extensibility (bridges, stacked floors, pits, overhangs)

---

## Current State (Verified from Repo)

The renderer currently distinguishes between:

* **Surface tops** (floors, stair tops)
* **Aprons / underlays** (floor & stair vertical faces)
* **Walls** (occluders rendered after entities)

Problems observed:

* Aprons are generated separately from walls
* Aprons require special depth logic
* Certain multi-height edge cases break determinism

---

## Target Architecture (End State)

### Core Rule

**There is exactly one vertical occluder system.**

All vertical faces are represented as **wall segments**:

* Structural walls
* Floor edges
* Cliffs
* Ledges
* Pit boundaries

There is no rendering or gameplay concept called “floor apron”.

---

## Conceptual Model

### Surfaces

* Represent walkable horizontal planes
* Define logical height (`z`)
* Never handle vertical occlusion

### Occluders (Walls)

* Represent vertical faces between heights
* Are always rendered **after** surfaces and entities
* Are depth-sorted globally and deterministically

Floor edges are implemented as **short wall segments** with a specific wall skin.

---

## Wall Skins (Data-Driven)

Wall appearance is selected via a **wallSkin** field.

Examples:

* `FLOOR_EDGE`
* `STONE`
* `BRICK`
* `SEWER`
* `WOOD`

The engine never branches on wallSkin. Rendering is fully data-driven.

---

## Step 0 — Contract Freeze

### Decisions Locked

* Floor aprons are deprecated
* Floor edges are walls
* Walls are the only occluders
* Wall skins control appearance

### Result

* No code changes yet
* Architectural intent is frozen

### Achievements

* [x] Occlusion unified conceptually
* [x] Apron system deprecated

---

## Step 1 — Data Model Changes

### RenderPiece Contract

`RenderPiece` MUST support:

* `kind: "WALL"`
* `wallDir: "N" | "E" | "S" | "W"`
* `wallSkin: string`
* `zFrom: number`
* `zTo: number`

`RenderPiece` MUST NOT contain:

* apron-specific fields
* apron ownership logic

### Invariants

* All vertical faces are walls
* Wall height = `zTo - zFrom`

### Achievements

* [ ] RenderPiece fully wall-centric

---

## Step 2 — Map Compilation: Floor Edge Wall Generation

For each surface `(tx, ty, z)`:

For each direction `N | E | S | W`:

1. Query neighbor surface at `(tx + dx, ty + dy)`
2. Determine neighbor height `neighborZ`

Emit a wall segment when:

* Neighbor surface does not exist **or**
* `neighborZ < z`

Wall parameters:

* `wallDir = direction`
* `wallSkin = FLOOR_EDGE`
* `zTo = z`
* `zFrom = neighborZ` (or base height)

### Invariants

* No duplicate wall segments
* Walls exist only where vertical faces exist

### Achievements

* [ ] Floor edge walls generated deterministically

---

## Step 3 — Removal of Floor Apron System

### Delete

* Apron generation logic
* `apronUnderlaysInView`
* Apron render passes
* Apron depth calculations

### Result

* No apron code remains
* All vertical visuals come from walls

### Achievements

* [ ] Apron system fully removed

---

## Step 4 — Renderer Simplification

### Render Order (Hard Rule)

1. Surface tops
2. Entities
3. Occluders (all walls)

### Renderer Guarantees

* No vertical face is rendered before a surface
* No surface is rendered after an occluder

### Achievements

* [ ] Renderer has a single occluder pass

---

## Step 5 — Wall Skin Expansion

### Purpose

Enable visual diversity without engine complexity.

### Rules

* wallSkin selects sprite atlas
* wallDir selects orientation
* wall height controls sprite slicing or tiling

### Achievements

* [ ] Multiple wall skins supported

---

## Step 6 — Stairs Integration

### Rule

Stairs MAY continue to emit bespoke wall skins:

* `STAIR_FACE`
* `STAIR_SIDE`

They still obey:

* Wall occluder rules
* Render ordering rules

### Achievements

* [ ] Stairs fully integrated into wall system

---

## Step 7 — Validation Scenarios

The system MUST correctly render:

* Single-height floors
* Multi-height terraces
* Overlapping bridges
* Diagonal visibility edges
* Deep pits

No special-case logic is allowed.

### Achievements

* [ ] All validation scenarios pass

---

## Final Achievements Checklist

* [ ] Floor aprons removed
* [ ] Single occluder system
* [ ] Deterministic depth ordering
* [ ] Multi-height safe
* [ ] Renderer simplified
* [ ] Asset-driven wall visuals

---

## Final Statement

This transition eliminates an entire class of rendering bugs by removing aprons as a concept.

The engine becomes:

* Simpler
* More predictable
* More extensible

Vertical faces are walls. No exceptions.
