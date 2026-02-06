# Screen-Aligned Logical Grid Migration Plan (Hybrid: Whole-File Rewrites + Bridge)

**Decision:** Option A1 — entities store **logical grid** `(gx, gy)` + **sub-tile offsets**.  
**North = 12:00 on screen** is the only meaning of “north” in gameplay, authoring, and AI.

This repo already uses a true iso projection (tile/world → screen) in `src/game/visual/iso.ts` (`worldToScreen`, `worldDeltaToScreen`). fileciteturn2file13  
So the move is: **make gameplay screen-aligned** and treat iso/world coords as derived render/query space.

**Instruction:** Do not write time-gated comments like “later we will…” inside code. Use stable, contract-style comments only.

---

## The Hybrid Approach (what changes vs “phases”)

We still migrate in an order, but instead of “small diffs everywhere”, we do **whole-file rewrites** one-by-one, while keeping a **compatibility bridge** until every consumer has switched.

> Rule: **Only one module** may convert between coordinate spaces.

---

## Progress
- Added `src/game/coords/grid.ts` as the single conversion module.
- Rewrote `src/game/world.ts` for grid-authoritative positions with bridge accessors.
- Rewrote `src/game/systems/movement.ts` for grid-space input, steering, and facing.
- Added grid-spawn wrappers for projectiles/pickups/zones and used grid-based pickup spawns on enemy kills.
- Migrated projectiles, pickups, and zones to maintain grid-authoritative anchors alongside derived world positions.
- Tightened remaining movement/collision updates to sync through grid anchors.
- Removed world-space fallback recovery in render/movement/xp (grid-first everywhere).
- Targeting now computes direction and range from grid space before converting to world.
- Weapon firing now uses grid-native projectile/zone spawns and grid-space aim.
- Replaced world-space firing/targeting math in weapons with grid-first helpers.
- Removed projectile/pickup/zone world-position arrays; world positions are now derived from grid anchors.
- Removed player/enemy world-position fields and converted all remaining systems to use grid-derived world positions.

---

## 1) Keep vs Rewrite (repo-specific)

### Keep (unchanged)
- Tile art loading / skins / registry content (mostly position plumbing).
- Render pipeline *structure* (tops → entities → curtains) — just swap coordinate inputs. fileciteturn1file2turn2file2
- `TableMapDef` format *as a container*, plus map selection (`setActiveMap`). fileciteturn1file13

### Rewrite / Touch (coordinate meaning is baked in)
- `src/game/world.ts` — introduce grid-native authoritative positions. fileciteturn2file9
- Movement & AI steering — must use grid N/E/S/W.
- `src/game/map/kenneyMap.ts` public API — should become grid-native wrappers. fileciteturn1file13turn1file6
- Any code that uses `worldDeltaToScreen` for “direction naming” (facing, stair dirs). fileciteturn2file13

---

## 2) Coordinate Contract (A1)

### 2.1 Logical grid (screen-aligned)
We introduce `(gx, gy)` with:

- `gx + 1` = **east** (screen right)
- `gy + 1` = **north** (screen up)

*(Sign choice is yours; above matches your request “y+1 = north”.)*

### 2.2 Sub-tile offsets
Entities store:

- integer anchor: `gxi, gyi`
- fractional offsets: `gox, goy` (floats)

Logical position:
- `gx = gxi + gox`
- `gy = gyi + goy`

### 2.3 Derived iso tile coords (render basis)
Your renderer’s diamond iso uses a tile basis where screen axes are diagonal; a clean mapping is:

- `gx = tx - ty`
- `gy = -(tx + ty)`  *(minus makes “+gy = screen up”)*

Invert (continuous):
- `tx = (gx - gy) / 2`
- `ty = (-gx - gy) / 2`

**Parity note:** tile `(tx,ty)` are integers only when `(gx,gy)` parity matches.  
**Bridge choice (recommended):** allow fractional `tx,ty` for entity world positions; only tile lookups round/floor carefully.  
This avoids the “step by 2” annoyance while preserving smooth motion.

---

## 3) Single Conversion Module (new)

Create: `src/game/coords/grid.ts`

Exports (names flexible):
- Types: `GridPos`, `GridAnchor`, `GridDelta`
- `gridToTile(gx, gy): { tx: number, ty: number }`
- `tileToGrid(tx, ty): { gx: number, gy: number }`
- `gridToWorld(gx, gy, tileWorld): { wx: number, wy: number }`
- `worldToGrid(wx, wy, tileWorld): { gx: number, gy: number }`
- `gridDirDelta(dir: N|E|S|W|NE|...): { dx, dy }` where **N is 12:00**.

**Hard rule:** No other file performs these transforms.

---

## 4) Compatibility Bridge (temporary but explicit)

During migration, we keep old call sites working by providing derived accessors:

- `playerWorldPos(w): { wx, wy }`
- `enemyWorldPos(w, i): { wx, wy }`
- `gridAtPlayer(w): { gx, gy }`

Bridge exists until the last consumer switches; then it is deleted.

---

## 5) Whole-File Rewrite Order (recommended)

### File 1 — `src/game/coords/grid.ts` (NEW)
Deliverable:
- conversion functions + direction deltas
- minimal contract comment block (no roadmap text)

### File 2 — `src/game/world.ts` (REWRITE)
Deliverable:
- Player/enemy authoritative positions in grid anchors + offsets
- Bridge getters that output old-style world coords (`px/py` equivalents) for rendering and queries
- Keep existing fields only if needed for compatibility; mark as derived, not authoritative

Why early:
- Everything else depends on “what is a position?”

### File 3 — Movement system (REWRITE)
Deliverable:
- Player movement integrates in **grid space**
- Input mapping uses N/E/S/W = screen up/right/down/left

Compatibility:
- Rendering still reads derived world pos.

### File 4 — `src/game/systems/render.ts` (REWRITE)
Deliverable:
- camera follows `playerWorldPos()`
- entities use derived world pos
- depth sorting stays in render space, but positions now come from grid

This gives immediate visual validation that “north is up”.

### File 5 — `src/game/map/kenneyMap.ts` API surface (REWRITE)
Deliverable:
- Add grid-native public wrappers:
  - `getTileAtGrid(gx, gy)`
  - `heightAtGrid(gx, gy)`
  - `walkInfoGrid(gx, gy)`
- Internally, wrappers may convert `grid -> world` and reuse old logic temporarily.
- Update call sites to prefer the grid API.

### File 6 — Enemies (Factory + AI) (REWRITE)
Deliverable:
- Spawn positions defined in grid coords
- Steering and “face direction” computed in grid space
- Convert to render coords only at draw/query boundary

### File 7 — Projectiles / pickups / zones (REWRITE per system)
Deliverable:
- Either migrate to grid positions like entities **or** maintain world space but only ever derive grid when needed.
- Prefer migrating (consistency).

### File 8 — Delete bridge + old coordinate assumptions (CLEANUP)
Deliverable:
- Remove `px/py` authoritative usage
- Remove ad-hoc direction math (`worldDeltaToScreen` used as gameplay direction)
- Enforce rule: gameplay uses grid.

---

## 6) Repo hotspots (where to expect changes)

- `src/game/world.ts` (authoritative position fields) fileciteturn2file9
- `src/game/systems/render.ts` (camera + draw pos plumbing) fileciteturn1file2turn2file2
- `src/game/map/kenneyMap.ts` (map query surface) fileciteturn1file13turn1file6
- Enemy factory/spawn (`src/game/factories/enemyFactory.ts`) fileciteturn2file7
- Iso math (`src/game/visual/iso.ts`) is kept; it becomes “render-only”. fileciteturn2file13

---

## 7) Definition of Done
- “North” always means **screen-up (12:00)** in:
  - map authoring tokens
  - movement controls
  - enemy steering/facing
  - procedural gen corridor directions
- Rendering remains Kenney iso and unchanged visually (except bugs fixed).
- No file outside `coords/grid.ts` performs space conversions.
