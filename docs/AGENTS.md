# ai/AGENTS.md

Instruction to LLM

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

- TypeScript + Vite + Canvas2D
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

Pass 0: UNDERLAYS (all apron underlays, depth-sorted)

For each zLogical layer (ascending):
1. TOPS
2. ENTITIES
3. OCCLUDERS

Rules
- Occluders must render after entities
- All relevant layers must be included (not only surface layers)

Achievements
- [ ] Entities are hidden by higher occluders via render order alone

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
- Boss behavior is keyed by floor identity
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

## 13. Current focus

High-value, allowed work:
- Finalize direction mapping helper
- Keep apron vs occluder separation strict
- Centralize remaining render heuristics into map compilation
- Strengthen tile-grid-based vertical collision
