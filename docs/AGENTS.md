# docs/AGENTS.md

Audience note:
This file defines repository and engine architecture invariants for implementation work.
It is not the source of truth for design-discussion behavior.
Design discussions are governed separately by the RatGame Design Partner Protocol.

Instruction to implementation agents

* No time-gated comments
* Contract-style documentation only
* This document is linear and complete
* Each section represents a locked architectural rule
* Achievements are boolean invariants; checked items must remain true
* No change may invalidate agents.md; if a rule becomes untrue, agents.md must be updated first

---

## 0. Purpose

This document defines the **non-negotiable architectural contracts** of this repo.
Its goal is to prevent accidental redefinition of Z semantics, directions,
map ownership, and rendering order.

If a change violates a rule here, the rule must be updated first.

Achievements
- [ ] Core spatial rules are enforced without per-system redefinition

---

## 1. Engine shape (system rules)

- TypeScript + Vite
- World rendering supports Canvas2D and WebGL backends
- ECS-lite: systems read/write world state and emit events
- Systems do not call each other directly
- Cross-system communication happens through shared world fields or events

Rules
- A system may only mutate fields it owns
- Ownership means a system is the sole writer of a field or structure by contract
- New shared behavior must be centralized in helpers, not duplicated

Achievements
- [ ] No system-specific spatial or render math exists outside shared helpers

---

## 2. Coordinate spaces (do not improvise)

This engine uses four distinct spaces:

- Table space: map authoring grid (TableMapDef)
- Tile space: compiled logical grid used for map queries
- World space: continuous coordinates for movement and collision
- Screen space: canvas pixels after isometric projection

Rules
- All conversions must be explicit
- Tile or table coordinates must never be mixed with screen math
- World to screen projection is centralized

Achievements
- [ ] All coordinate conversions flow through shared helpers
- [ ] No system redefines axis orientation or dimension meaning
## 2.1 Axis and dimension identity (locked)

Table space and tile space share the same axis orientation.

Canonical truths:
- +x is east (right)
- +y is south (down)
- Width extends along +x
- Height extends along +y

One-liners (never revisit):
> Excel +y == Tile-grid +y == South  
> w+ == x+ and h+ == y+

Rules
- Excel column index maps directly to tile-grid `x`
- Excel row index maps directly to tile-grid `y`
- `w` is the extent of +x (number of columns)
- `h` is the extent of +y (number of rows)
- No axis swaps, sign flips, or rotations are permitted
- No system may reinterpret width as height or height as width

Forbidden
- Any Excel→tile transform that swaps or flips axes
- Any bounds logic that uses `h` as an x-extent or `w` as a y-extent
- Any “north-is-right” or compass-compensation hacks

Achievements
- [ ] Table space, tile space, and grid math use identity axis mapping
- [ ] No code path swaps `w/h` or `x/y`

---

## 3. Direction semantics (single source of truth)

Directional names (N/E/S/W) are **screen-aligned**, not math-aligned.

Rules
- Directional semantics (N/E/S/W) are defined in tile space relative to screen space
- Table space has no inherent directional meaning
- World space derives direction only through tile space
- Screen space is a projection target, not a source of semantics
- North always means up on screen
- Stair direction tokens describe uphill direction
- Wall, apron, stair, movement, and debug logic must agree

If direction meaning changes:
- It must change in one place
- All consumers must be updated in the same patch

Achievements
- [ ] All direction semantics route through a single direction-mapping helper

---

## 4. Z is a contract

Z is not a single value.

Distinct roles exist:
- zLogical: gameplay layer membership
- zVisual: render sorting depth
- zOcclusion: visibility blocking
- zBase / zTop: physical height band

Rules
- Never overload one Z value to mean multiple things
- New vertical behavior requires a new named field

Achievements
- [ ] No system derives height without querying map helpers or Z roles

---

## 5. Surfaces and connectors

- Floors are surfaces
- Stairs are connectors between surfaces
- Walls are occluders

Rules
- Movement chooses a surface explicitly
- Stairs never behave as generic walkable floors
- Multiple surfaces per (x, y) are supported via queries, not hacks

Achievements
- [ ] Movement and spawn logic exclusively use surface queries

---

## 6. Map compilation contract

Maps are authored as TableMapDef and compiled into a runtime map.

Compiled map must expose:
- getTile(tx, ty)
- surfacesAtXY(tx, ty)
- layer-grouped surfaces and occluders
- apron underlays and deferred apron data

Rules
- Systems must read from the active compiled map only
- Procedural and authored maps use the same compile pipeline

Achievements
- [ ] No runtime system reads raw TableMapDef data

---

## 7. Rendering terminology

Definitions:
- Aprons: background thickness art (non-occluding)
- Underlays: apron prepass visuals
- Tops: walkable surface faces
- Entities: players, enemies, projectiles
- Occluders: walls only

Rules
- Aprons never block visibility
- Occluders are the only visibility blockers

Achievements
- [ ] Aprons and occluders are stored and rendered in distinct structures

---

## 8. Render order (locked)

Current render pipeline:

1. `GROUND`
2. `WORLD`
3. `SCREEN/UI`

Rules
- chunk-rasterized ground remains in the `GROUND` pass
- all world-space competing objects share one `WORLD` ordering domain
- screen-space debug, HUD, and full-screen overlays stay in `SCREEN/UI`
- render ordering is driven by shared world sort metadata, not hidden phase-specific depth heuristics

Achievements
- [x] Final world ordering is not delegated to legacy underlay/entity/light/occluder phase splits
- [x] Final screen-space pass keeps only ambient darkness/tint and screen overlays
- [x] Legacy light-mask occlusion/debug pipeline is removed from runtime render path

---

## 9. Collision and combat helpers

Rules
- Broad-phase uses spatial hashing
- Tile-grid queries determine walkability and blocking
- New collision rules must live in shared helpers
- Prefer tile/grid-based vertical collision over bespoke ramp math

Achievements
- [ ] Projectile vs vertical-face collision is grid-driven and centralized

---

## 10. Gameplay loop invariants

- Runs are deterministic from seed and floor index
- Act-boss behavior is owned by the canonical boss encounter pipeline
- UI and audio react to events and game state only

Rules
- Systems must not reach into DOM or audio directly
- Emit events; let dedicated systems consume them

Achievements
- [ ] Gameplay systems do not directly manipulate UI or audio

---

## 11. Editing rules

If you change any of these, update all consumers together:
- Direction semantics
- Z role definitions
- Map compile outputs
- Render pass order
- Axis or dimension identity (x/y, w/h)
- 
When adding new behavior:
- Centralize logic
- Avoid new magic constants

Achievements
- [ ] Core spatial and render rules exist in exactly one place each

---

## 12. Contract-driven changes (how to apply new contracts)

This repo evolves through **explicit contract documents** (`*.md`).

When a new contract file is explicitly introduced (example: `render4.0.md`),
the following rules apply.

LLM instruction pattern:
> New contract: "render4.0.md"  
> Read it and tell me when ready.

### Contract consumption rules

- Read the entire contract before making any changes
- Do not implement anything until the contract is fully understood
- Do not reinterpret or weaken agents.md unless explicitly overridden
- Do not introduce time-gated comments or speculative notes
- Treat each section as a locked architectural step

If a contract conflicts with agents.md:
- The conflict must be explicit and intentional
- Silent conflicts are invalid

### Step execution and gating

- Execute the contract one section at a time, in order
- After completing a section:
    - Mark its Achievements as completed in the contract
    - Update any affected Achievements in agents.md
    - Summarize newly true invariants
    - State the next step
    - Stop execution

The LLM must not proceed until the user responds with:
> next

Partial execution or batching steps is invalid.

### Completion signal

- When all contract steps are complete and achievements are marked:
    - Provide a brief final state summary
    - State that the contract is complete

---
## Renderer Architecture Contract (Post-Decomposition)

The renderer is a staged pipeline. `render.ts` is a conductor only and must not contain subsystem logic.

### Pipeline Stages (locked)

1. prepareRenderFrame — frame context, camera, viewport, settings snapshot
2. collectFrameDrawables — gather all world drawables (delegates to subsystems)
3. sortFrameDrawables — ordering authority (single source of truth)
4. executeWorldPasses — ground, world, shadows, lighting
5. executeScreenOverlays — screen-space effects
6. executeUiPass — UI layer
7. executeDebugPass — debug overlays (optional)

### Ownership Rules (locked)

* structures → presentation/structures/*
* structure shadows → presentation/structureShadows/*
* structure triangles → presentation/structureTriangles/*
* static relight → presentation/staticRelight/*
* debug overlays → presentation/debug/*

### Hard Rules

* render.ts must NOT contain:

  * slice generation
  * triangle math
  * shadow algorithms
  * relight algorithms
  * debug drawing logic
* No large loops (>100 lines) inside renderSystem
* No new "renderUtils" or helper dump files
* All new rendering features must attach to an existing stage

### Principle

The renderer is a pipeline of systems, not a system itself.

---

## Canonical Documents

The canonical references are in the `docs/systems` folder. They must be updated to reflect the live implementation and are the source of truth for renderer architecture.:


Rules:

- Maintain these documents in the same patch as any related changes.
- Keep it implementation-accurate and present tense
- Document the live pipeline, not the intended future pipeline
- If behavior is mixed, partial, or intentionally deferred, state that explicitly
- Remove stale references to deleted files, stages, or backend paths immediately
