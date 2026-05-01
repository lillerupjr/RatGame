# AGENTS.md

Architecture invariants for implementation agents. Every rule is locked.
If a change violates a rule, update this file first, then implement.
No time-gated comments. No speculative notes. Contract-style only.

---

## 1. Engine shape

- TypeScript + Vite
- Canvas2D and WebGL rendering backends
- ECS-lite: systems read/write world state and emit events; they do not call each other directly
- Cross-system communication via shared world fields or events only
- A system may only mutate fields it owns (sole writer by contract)
- New shared behavior must be centralized in helpers, not duplicated

---

## 2. Coordinate spaces

Four distinct spaces — never mix them:

| Space | Purpose |
|-------|---------|
| Table space | Map authoring grid (TableMapDef) |
- Tile space | Compiled logical grid for map queries |
| World space | Continuous coords for movement and collision |
| Screen space | Canvas pixels after isometric projection |

- All conversions must be explicit and flow through shared helpers
- Tile/table coordinates must never be mixed with screen math
- World-to-screen projection is centralized

**Axis identity (locked):** `+x` = east, `+y` = south, `w` = x-extent, `h` = y-extent.
Excel column → tile `x`. Excel row → tile `y`. No swaps, flips, or rotations. Ever.

---

## 3. Direction semantics

N/E/S/W are **screen-aligned**. North = up on screen.

- Direction semantics are defined in tile space relative to screen space
- Table space has no directional meaning
- Stair direction tokens describe uphill direction
- Wall, apron, stair, movement, and debug logic must all agree
- Direction meaning must route through a single direction-mapping helper
- If direction meaning changes: one place, all consumers updated in the same patch

---

## 4. Z roles

Z is not a single value. Each role is distinct and must not be overloaded:

- `zLogical` — gameplay layer membership
- `zVisual` — render sorting depth
- `zOcclusion` — visibility blocking
- `zBase` / `zTop` — physical height band

New vertical behavior requires a new named field, not reuse of an existing Z role.

---

## 5. Surfaces and connectors

- Floors are surfaces. Stairs are connectors between surfaces. Walls are occluders.
- Movement chooses a surface explicitly
- Stairs never behave as generic walkable floors
- Multiple surfaces per (x, y) are supported via queries, not hacks

---

## 6. Map compilation

Maps are authored as `TableMapDef` and compiled into a runtime map.

Compiled map must expose: `getTile(tx, ty)`, `surfacesAtXY(tx, ty)`, layer-grouped surfaces and occluders, apron underlays and deferred apron data.

- Systems must read from the active compiled map only — never raw `TableMapDef`
- Procedural and authored maps use the same compile pipeline

---

## 7. Rendering

**Terminology:**

| Term | Definition |
|------|-----------|
| Aprons | Background thickness art — non-occluding |
| Underlays | Apron prepass visuals |
| Tops | Walkable surface faces |
| Entities | Players, enemies, projectiles |
| Occluders | Walls only |

Aprons never block visibility. Occluders are the only visibility blockers.

**Render order (locked):** `GROUND` → `WORLD` → `SCREEN/UI`

- Chunk-rasterized ground stays in `GROUND`
- All world-space objects share one `WORLD` ordering domain
- Screen-space debug, HUD, and overlays stay in `SCREEN/UI`
- Ordering driven by shared world sort metadata only

**render.ts is a conductor — it must not contain:** slice generation, triangle math, shadow algorithms, relight algorithms, or debug drawing logic.

Pipeline stages (locked):
1. `prepareRenderFrame`
2. `collectFrameDrawables`
3. `sortFrameDrawables`
4. `executeWorldPasses`
5. `executeScreenOverlays`
6. `executeUiPass`
7. `executeDebugPass`

Subsystem ownership:
- structures → `presentation/structures/*`
- structure shadows → `presentation/structureShadows/*`
- structure triangles → `presentation/structureTriangles/*`
- static relight → `presentation/staticRelight/*`
- debug overlays → `presentation/debug/*`

---

## 8. Collision and combat

- Broad-phase uses spatial hashing
- Tile-grid queries determine walkability and blocking
- New collision rules must live in shared helpers
- Prefer tile/grid-based vertical collision over bespoke ramp math

---

## 9. Gameplay loop

- Runs are deterministic from seed and floor index
- Act-boss behavior is owned by the canonical boss encounter pipeline
- UI and audio react to events and game state only — systems must not reach into DOM or audio directly

---

## 10. Progression

The run progression model is ring-first. Rings, stored ring modifier tokens, and immediate hand effects are the only progression families.

- New progression behavior must be implemented under `src/game/progression/`
- Rings own build identity — no parallel relic or draft reward system may be introduced
- Reward generation and vendor offers must consume typed progression options, not string payloads
- Hand structure changes are owned by ring progression state, not ad hoc stat modifiers
- Triggered ring effects must execute through the centralized progression trigger dispatcher
- Passive ring effects are applied through centralized progression runtime effects

---

## 11. Contract workflow

When a contract file is introduced:

- Read the entire contract before making any changes
- Do not implement until fully understood
- Silent conflicts with this file are invalid — conflicts must be explicit and intentional
- Execute one section at a time; stop after each and wait for `next`
- Mark section achievements in the contract after completion
- Update this file if any rule here is affected