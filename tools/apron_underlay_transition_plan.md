# Transition Plan: Split Aprons Into Underlay + Rewrite render.ts (One-Go)

This document maps a single, deliberate transition from the current **“CURTAINS as one bucket”** pipeline to a new pipeline where:

- **Floor + stair aprons** are **UNDERLAYS** (non-occluding thickness) rendered **before any tops**.
- **Walls / true vertical faces** remain **OCCLUDERS** rendered **after entities**, per-layer.
- The renderer becomes simpler: **TOPS → ENTS → OCCLUDERS**, with a **global UNDERLAY prepass**.

> Scope: this is written against the current repo state in `repo_dump.txt` (Feb 2026).  
> Goal: prep the repo first (types + map compile outputs), then do **one big render.ts rewrite**.

---

## Target Render Strategy

### Pass 0: APRON UNDERLAY (global)
Draw **all floor/stair aprons** (non-occluding) first, back-to-front.

### For each `zLogical` layer (ascending)
1) **TOPS** for this layer (floor/stair tops)  
2) **ENTS** that live on this layer  
3) **OCCLUDERS** (walls / cliff faces / true vertical faces) for this layer

**Why this works**
- Entities are always above the surface they stand on (TOPS precede ENTS).
- Higher floors naturally cover lower-layer entities because you draw lower layers first.
- Occluders still hide entities as intended.
- Aprons stop incorrectly covering their own tops because they’re no longer in the occluder pass.

---

## Non-Negotiable Classification Change

Right now you have one combined concept (“curtains”) used for:
- floor aprons (thickness)
- stair aprons (thickness)
- walls (occluders)

The transition requires **two classes** at compile-time:

### A) Underlay Aprons (non-occluding)
- Floor apron S/E (and later N/W if you add sprites)
- Stair apron (whichever sides you generate)
- Any “tile thickness” visuals that should never hide entities/tiles

### B) Occluders (occluding)
- Wall segments (W2/W4/W8…)
- True cliff faces / blocking faces (future)
- Anything meant to hide entities behind it

---

## Files & Systems Affected

### Must change *before* the big `render.ts` rewrite
These changes make the renderer rewrite straightforward and low-risk.

1) **Map compile output**
- `src/game/map/kenneyMapLoader.ts`  
  - Add explicit kind/classification for curtain instances  
  - Provide fast accessors for:
    - `apronUnderlaysInView(...)`
    - `occludersByLayer(...)` or `occludersInLayer(layer, viewRect)`

2) **Curtain types**
- `src/game/map/kenneyMapLoader.ts` (or a nearby `types.ts`)
  - Add:
    - `CurtainClass = "UNDERLAY" | "OCCLUDER"`
    - `CurtainKind = "FLOOR_APRON" | "STAIR_APRON" | "WALL" | ...`

3) **Sprite selection**
- `src/game/visual/cutainSprites.ts` (or equivalent)
  - Ensure `getFloorApron(...)` and `getStairApron(...)` are usable without assuming “occluder”
  - Ensure walls remain accessible as-is (or via `getWallCurtain(...)`).

4) **Public map API used by renderer**
- `src/game/map/kenneyMap.ts`
  - Export the new accessors and types needed by `render.ts`:
    - `getApronUnderlays()` or `apronUnderlaysInView(...)`
    - `occludersByLayer()` or `occludersInViewByLayer(...)`

> Everything else should be staged to keep the render rewrite focused.

---

## Pre-Render Prep: Exact Data Model Changes

### 1) Update curtain instance type
Add these fields to your curtain instance structure:

- `cls: "UNDERLAY" | "OCCLUDER"`
- `kind: "FLOOR_APRON" | "STAIR_APRON" | "WALL" | ...`
- `zLogical: number` (already present in current logic)
- `tx, ty` (or `x, y` in tile coords)
- `depthKeyHint` (optional; renderer can compute from world→screen anyway)
- `sprite` metadata:
  - `spriteId` OR `spriteKind + dir + size + flipX` (whatever you already do)
  - `flipX` boolean

Keep whatever placement fields you already rely on (screen anchor offsets, dy offsets).

### 2) Generate underlays as UNDERLAY, not OCCLUDER
In compile:

- Floor apron S/E generation:
  - mark as `cls="UNDERLAY", kind="FLOOR_APRON"`
- Stair apron generation:
  - mark as `cls="UNDERLAY", kind="STAIR_APRON"`
- Wall segments:
  - mark as `cls="OCCLUDER", kind="WALL"`

### 3) Store two indices (fast lookups)
At minimum:

- `underlays: Curtain[]` (or `ApronUnderlay[]`)
- `occludersByLayer: Map<number, Curtain[]>`

Optional extra:
- If you have lots of curtains, add `byKey` indices for view queries:
  - `underlaysByKey: Map<string, Curtain[]>`
  - `occludersByKeyAndLayer: Map<string, Curtain[]>`

But start simple: your view size is not huge yet.

### 4) Add view query helpers (renderer-facing)
Provide functions the renderer can call:

- `apronUnderlaysInView(view: ViewRect): Curtain[]`
- `occludersInViewForLayer(layer: number, view: ViewRect): Curtain[]`

If you already have `curtainLayers()` and `curtainsInLayer(layer)`, keep them but split by class.

---

## Pre-Render Prep Work Checklist

Do these in order; each item is a small, reviewable change.

### Prep A — Types + compile
- [x] Add `CurtainClass`, `CurtainKind` enums/unions
- [x] Update curtain creation sites to set `(cls, kind)`
- [x] Split storage: `underlays[]` and `occludersByLayer`
- [x] Update exported map getters to return the split structures
- [x] Ensure `curtainLayers()` returns **only occluder layers** (walls) OR rename:
  - `occluderLayers()`
  - `underlayLayers()` (optional, often not needed)

### Prep B — Renderer inputs
- [x] Add a helper that yields visible tile bounds (you already effectively compute this)
- [x] Add `apronUnderlaysInView(...)` and `occludersInViewForLayer(...)`
- [x] Keep existing surface queries (`surfacesAtXY`, `tileHeight`, etc.) stable

### Prep C — Debug aids (optional but recommended)
- [x] Add a debug toggle to render underlays tinted/outlined (no new art)
- [x] Add debug toggle to render occluders bounding boxes / ids

> Once Prep A/B land, **stop**. Don’t touch render.ts yet.

---

## The Big One-Go Rewrite: render.ts Plan

This rewrite is “all at once” but still structured and testable.

### Step 1 — Define the new passes in code
In `render.ts`, create local arrays:

- `underlayDraws: DrawCmd[]`
- `topDrawsByLayer: Map<number, DrawCmd[]>` (optional; you already stream draw)
- `entDrawsByLayer: Map<number, EntDraw[]>` (you already have `itemsByLayer`)
- `occluderDrawsByLayer: Map<number, DrawCmd[]>`

You do **not** need to pre-bake tops into arrays if your current sweep is correct.
- [x] Underlay prepass and occluder draw helpers added in `render.ts`.

### Step 2 — Build the layer list (zLogical) from SURFACES + OCCLUDERS + ENTS
Target:
- layer list includes:
  - all visible surface layers (as today)
  - all occluder layers (walls), using new `occluderLayers()` or scanning `occludersByLayer`
  - all entity layers (player/enemy/projectile) when `RENDER_ALL_HEIGHTS`

**Important:** Underlays do **not** contribute to the layer list; they render once.
- [x] Layer list now adds only occluder layers; underlays are excluded.

### Step 3 — Render Pass 0: Underlays
Before the per-layer loop:

1) Query `apronUnderlaysInView(viewRect)`
2) Convert each underlay to a draw command:
   - compute screen position from tile/world
   - include flipX and sprite selection
3) Sort back-to-front using your `renderDepthFor()` (screenY primary)
4) Draw them

This ensures aprons never cover their own tops.
- [x] Underlay pass draws apron underlays in view, depth-sorted.

### Step 4 — Per-layer loop: TOPS → ENTS → OCCLUDERS
For each `layer` ascending:

#### 4A) TOPS
- Use your existing diamond traversal of tiles
- For each tile, `surfacesAtXY(tx,ty)`:
  - filter to surfaces whose `zLogical === layer`
  - draw top image at correct anchor
- Do **not** enqueue underlays here anymore.

#### 4B) ENTS
- Use your existing `itemsByLayer[layer]`
- Sort by `renderDepthFor()` and draw

#### 4C) OCCLUDERS
- Query `occludersInViewForLayer(layer, viewRect)`
- Convert to draw commands, depth-sort, draw

> This keeps walls working as occluders without interfering with tops.
- [x] Per-layer order is now TOPS â†’ ENTS â†’ OCCLUDERS.

### Step 5 — Remove/replace the old curtain queue
Delete or disable the old:
- `curtainDraws` accumulation during TOPS pass
- “CURTAINS pass after ENTS” that includes aprons

Replace with:
- Underlay pass + Occluder pass
- [x] Old curtain queue removed from the per-layer loop.

---

## Entity Strategy Under This Pipeline

### Entity bucketing rule
Each entity is assigned to one `zLogical` render layer:

- Player/enemies: the surface layer they stand on
- Projectiles:
  - choose layer = floor(zAbs / FLOOR_STEP) or nearest surface layer at (x,y)
  - keep vertical lift in pixels (`zLiftPx`) so they float visually

This keeps:
- “entities above their own floor”
- “upper floors cover lower entities”
- “walls occlude entities”

### Edge case: projectiles between layers
If you want projectiles to pass behind a wall segment at one layer but in front at another, you will eventually need:
- a more explicit occlusion Z model
But you don’t need that for this transition.

---

## Acceptance Tests (Manual)

Run these maps/scenarios after the rewrite:

### A) Apron correctness
- A single isolated floor tile: apron should appear “under” top, never above it.
- A platform edge: apron visible on exposed edges only.
- A long bridge: no apron seams flicker.

### B) Stair overlap regression
- The exact stair overlap case you had:
  - stair apron must not cover top surface
  - stair top must not interleave incorrectly with neighbors

### C) Occlusion behavior preserved
- A tall wall (W8*): should still occlude player walking behind it.
- A lower entity behind a higher platform: higher platform’s top should cover entity.

### D) Layer inclusion
- Any wall segment at zLogical > 0 renders (your previous bug fix stays valid).

---

## Minimal “Do Not Change Yet” List

To keep risk down, do **not** also change these in the same commit as the render rewrite:

- Direction conventions / grid remaps
- Z-axis contract refactors
- Stairs→connectors migration work
- Entity simulation or collision logic

This transition is purely:
- curtain classification + indices
- render passes restructured

---

## Commit Plan (Practical)

1) **Prep commit(s)**:  
   - Types + map compile split + accessors  
   - No render behavior changes (or feature flagged)

2) **Render rewrite commit**:  
   - New passes (Underlay + Tops + Ents + Occluders)  
   - Delete old curtain queue usage  
   - Keep existing tunables (scale, offsets) intact

3) **Follow-up** (after it’s stable):  
   - Reduce hacks: `stairLayerOffset`, seam fixes, etc.  
   - Expand apron placement (N/W) once art exists

---

## Notes on Future-Proofing

This split (UNDERLAY vs OCCLUDER) is the foundation you need for:
- bridges with underfaces
- cliffs
- connector-driven stairs (faces separate from walkable surfaces)
- per-surface “overhang tops” if you need ceilings later

It prevents “impossible” tradeoffs where making aprons correct breaks occlusion.
