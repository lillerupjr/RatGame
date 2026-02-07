# Repo Folder Spring Cleaning Contract (Minimal + Mechanical)

Instruction to LLM

* No time-gated comments
* Contract-style documentation only
* This document is linear and complete
* Each section represents a locked architectural step
* Achievements record completed invariants
* Do not proceed to the next section without user confirmation ("next")

---

## 0. Purpose (Locked)

Restructure the repo into a clearer folder layout without changing runtime behavior.

Scope:
- File moves, folder creation, import path updates
- No feature work
- No logic refactors
- No semantic changes to direction, Z, render order, map rules

Non-goals:
- Rewriting systems, events, or map logic
- Renaming gameplay concepts
- Changing rendering or collision behavior

Rules
- Every step is mechanical: move files, update imports, run typecheck/tests.
- If a move would require redesign, that move is out of scope.

Achievements
- [ ] Folder structure communicates ownership and boundaries at a glance
- [ ] No runtime behavior changes occur during this contract
- [ ] All builds and tests pass after each step

---

## 1. Locked Baseline Invariants (Must Always Hold)

Rules
- The entry remains `index.html` and `src/main.ts`.
- The engine still runs under Vite with TypeScript.
- Contract documents remain authoritative and must be easy to find.
- Direction/Z/render order semantics are not changed by this contract.

Achievements
- [ ] `npm run typecheck` succeeds after every step
- [ ] `npm test` (or current test command) succeeds after every step
- [x] No changes to gameplay/render semantics are introduced

Stop and wait for:
next

---

## 2. Docs Promotion (Contracts Become First-Class) (Locked)

Goal
- Move architectural contracts out of "ai" framing and into a stable docs area.

Actions
- Create:
    - `docs/`
    - `docs/contracts/`
    - `docs/gdd/`
- Move:
    - `src/ai/AGENTS.md` -> `docs/AGENTS.md`
    - `src/ai/contracts/*` -> `docs/contracts/*`
    - `src/ai/RatGame_gdd.md` -> `docs/gdd/RatGame_gdd.md`

Rules
- Do not edit contract content beyond updating internal file paths if they exist.
- Keep file contents ASCII-only if any edits are required.
- If any scripts or tooling references old paths, update references mechanically.

Achievements
- [x] `docs/AGENTS.md` exists and is the canonical location
- [x] `docs/contracts/` contains all contract files
- [x] Any references to old locations are updated (mechanically)
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 3. Runtime Boundary: Split Engine vs Game (Locked)

Goal
- Separate engine building blocks from game-specific content.

Target layout
- `src/engine/` contains reusable engine-level modules
- `src/game/` contains game-specific modules (content, factories, gameplay systems)

Actions (mechanical moves + import updates)
- Create:
    - `src/engine/`
    - `src/game/`
- Move these categories:
    - `src/game/world/*` -> `src/engine/world/*`
    - `src/game/visual/iso.ts` -> `src/engine/math/iso.ts`
    - `src/game/visual/*Sprites*.ts` -> `src/engine/render/sprites/*`
    - `src/game/audio/*` -> `src/engine/audio/*`
- Keep in `src/game/`:
    - `content/`
    - `factories/`
    - `systems/` (for now)
    - `map/` (for now)

Rules
- No code behavior changes. Only path changes and import rewrites.
- Do not rename exported symbols unless TypeScript requires it for path correctness.
- Do not change file contents except imports and any path literals.

Achievements
- [x] Engine-level files no longer live under `src/game/`
- [x] `src/engine/` exists with world/math/render/audio grouped by intent
- [x] All imports compile with the new paths
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 4. Visual Decomposition: Render vs Math vs Debug (Locked)

Goal
- Eliminate "visual" as a mixed bucket.

Target layout (inside engine)
- `src/engine/math/` for projection and coordinate transforms
- `src/engine/render/` for rendering helpers and sprite plumbing
- `src/engine/render/debug/` for overlays (compass, debug draws) if present

Actions
- Ensure `iso.ts` lives under `src/engine/math/`.
- Ensure sprite modules live under `src/engine/render/sprites/`.
- If any debug rendering helpers exist, place them under `src/engine/render/debug/`.

Rules
- Do not change direction semantics or projection math.
- This step is folder-level clarification only.

Achievements
- [x] Isometric math is only in `src/engine/math/`
- [x] Sprite plumbing is only in `src/engine/render/sprites/`
- [x] No mixed-purpose `visual/` folder remains
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 5. Systems Subfolders: Sim vs Spawn vs Progression vs Presentation (Locked)

Goal
- Make systems self-sorting by purpose to reduce "misc systems" sprawl.

Target layout (inside `src/game/systems/`)
- `sim/` (movement, collision, combat)
- `spawn/` (spawning)
- `progression/` (run loop, floors)
- `presentation/` (render + UI)
- `index.ts` (optional barrel)

Actions
- Create:
    - `src/game/systems/sim/`
    - `src/game/systems/spawn/`
    - `src/game/systems/progression/`
    - `src/game/systems/presentation/`
- Move system files into the right subfolder.
- Update imports mechanically.

Rules
- File moves must not change execution order or registration order.
- If there is a central place where systems are constructed/registered,
  preserve ordering exactly.

Achievements
- [x] Each system file is in a purpose folder
- [x] System wiring/registration order remains unchanged
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 6. Map Boundary: Formats vs Compile vs Generators vs Authored (Locked)

Goal
- Make the map pipeline boundary physically visible in the tree.

Target layout (inside `src/game/map/`)
- `formats/` (authoring formats)
    - `table/`
    - `json/` (even if empty for now)
- `compile/` (TableMapDef -> CompiledMap and related types)
- `generators/` (procedural generation)
- `authored/` (hand-authored maps)

Actions
- Create:
    - `src/game/map/formats/table/`
    - `src/game/map/formats/json/`
    - `src/game/map/compile/`
    - `src/game/map/generators/`
    - `src/game/map/authored/maps/`
- Move:
    - table types -> `formats/table/`
    - JSON loader (if present) -> `formats/json/`
    - kenney compile/loader -> `compile/`
    - procedural generator -> `generators/`
    - authored maps -> `authored/maps/`
- Update imports mechanically.

Rules
- No changes to compilation outputs or semantics.
- Procedural and authored maps must still flow through the same compile boundary.

Achievements
- [x] Map files are grouped by pipeline stage
- [x] Format boundary is explicit (formats vs compile)
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 7. Shared Utilities: Create Engine Util (Optional but Allowed) (Locked)

Goal
- Centralize tiny pure helpers that would otherwise duplicate.

Target layout
- `src/engine/util/` for small pure helpers (clamp, rng, assert)

Actions
- Create `src/engine/util/`
- Move only clearly pure helpers that are already duplicated or broadly useful.
- Update imports mechanically.

Rules
- Do not change helper behavior.
- Do not introduce new dependencies.
- If a helper is only used once, do not move it.

Achievements
- [x] A minimal `src/engine/util/` exists
- [x] No duplicated micro-helpers remain (where moved)
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 8. UI Boundary Note: Document DOM Ownership (Locked)

Goal
- Make DOM ownership explicit without moving `index.html`.

Actions
- Create `src/ui/README.md` with these rules:
    - HTML/CSS lives in `index.html` (for now)
    - Systems may not manipulate DOM directly unless they are presentation-owned
    - Prefer event-driven UI updates via a dedicated presentation system

Rules
- This step is documentation only.

Achievements
- [x] `src/ui/README.md` exists and states DOM ownership rules
- [x] No code behavior changes occur
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 9. Optional: Extract CSS from index.html (Tier 3) (Locked)

Goal
- Reduce the size of `index.html` by moving CSS into `src/ui/styles/`.

Actions
- Create `src/ui/styles/overlays.css`
- Move the large style block from `index.html` into that file
- Reference it from `index.html` using a standard stylesheet link

Rules
- The resulting UI must look identical.
- This is a pure extraction; do not change selectors or layout.

Achievements
- [x] CSS lives in `src/ui/styles/overlays.css`
- [x] `index.html` references the stylesheet
- [ ] UI is unchanged by visual inspection
- [ ] Typecheck/tests still pass

Stop and wait for:
next

---

## 10. Completion (Locked)

This contract is complete when:
- All steps that were executed have their achievements checked
- The tree matches the target layout for executed steps
- Typecheck/tests are green
- No behavior changes were introduced

Final response requirements
- Provide the final directory tree (top 3 levels is enough)
- State "Contract complete."

Achievements
- [ ] Contract complete.
