# Contract: Semantic Building Areas → Building Builder Pipeline (Per‑Map Packs) + Remove Sliced Buildings

## Goal
We will:

1) Hook the **building builder pipeline** to **semantic building areas** (rectangles in authored maps), so buildings are placed from a **per‑map building pack**.

2) Remove the **old sliced‑building pipeline** (code + assets).

3) Refactor current **test buildings** from **props** to **structures/buildings**.

4) Organize building art into **two packs**:
- `avenue_buildings`
- `china_town_buildings`

5) Keep **all building metadata** (size/height + all tuning/offsets + slicing parameters) **only** in `buildings.ts`.
No other file may define or override these values.

---

## Non‑Negotiables
- **Single source of truth:** building dimensions + height + offsets + slice tuning live in `src/game/content/buildings.ts` only.
- Maps declare only **semantic building areas** (e.g. `type: "building"` with `x,y,w,h`) and (at most) a **pack id**.
- The chosen building pack is resolved **once** per map activation and used by the builder.
- The system must no longer depend on “pre‑sliced” building PNGs for sorting.

---

# Part A — Data Model: Building Skins + Packs + Resolvers

## A1) buildings.ts owns ALL building metadata (including slice tuning)
**File:** `src/game/content/buildings.ts`

### Required types
- `export type BuildingSkinId = string;`
- `export type BuildingPackId = string;`
- `export const DEFAULT_BUILDING_PACK_ID: BuildingPackId = "default_buildings";`

### BuildingSkin (updated)
`BuildingSkin` must include **footprint**, **vertical**, **sprite ids**, plus **tuning** fields.

```ts
export type BuildingSkin = {
  id: BuildingSkinId;

  // Footprint + vertical
  w: number;              // tiles
  h: number;              // tiles
  heightUnits: number;    // HEIGHT_UNIT_PX units (or your chosen unit system)

  // Existing tuning
  anchorLiftUnits: number;
  wallLiftUnits?: number;
  roofLiftUnits?: number;
  spriteScale?: number;

  // NEW: per-building pixel tuning (single source of truth)
  // Use ONE or BOTH depending on your render pipeline needs.
  offsetPx?: { x: number; y: number };          // final per-building pixel nudge
  anchorOffsetPx?: { x: number; y: number };    // optional anchor-specific nudge

  // NEW: slicing/sort tuning (single source of truth)
  // Used if the renderer performs runtime slicing or slice-based ordering.
  slice?: {
    enabled: boolean;        // default false
    stepPx: number;          // slice spacing in px (e.g. 64)
    originPx?: { x: number; y: number }; // where slicing starts in the sprite (optional)
    offsetPx?: { x: number; y: number }; // extra nudge applied per-slice (optional)
  };

  // Sprite ids (structure pieces)
  roof: string;
  wallSouth: string[];   // ordered slices/pieces if applicable
  wallEast: string[];    // ordered slices/pieces if applicable
};
```

### Skin registry + pack registry
```ts
export const BUILDING_SKINS: Record<BuildingSkinId, BuildingSkin> = {
  // avenue_*, china_*, etc
};

export const BUILDING_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
  avenue_buildings: [
    // "avenue_building_1", ...
  ],
  china_town_buildings: [
    // "china_building_1", ...
  ],
  default_buildings: [
    // optional fallback
  ],
};
```

### Required resolvers (must be in buildings.ts)
**These functions are the ONLY supported entry points for choosing buildings from packs.**

```ts
export function resolveBuildingCandidates(packId: BuildingPackId): BuildingSkinId[] {
  return BUILDING_PACKS[packId] ?? BUILDING_PACKS[DEFAULT_BUILDING_PACK_ID] ?? [];
}

export function pickBuildingSkin(rng: RNG, packId: BuildingPackId): BuildingSkin {
  const candidates = resolveBuildingCandidates(packId);
  if (candidates.length === 0) throw new Error(`[buildings] No candidates for packId=${packId}`);

  const pickId = candidates[rng.int(0, candidates.length - 1)];
  const skin = BUILDING_SKINS[pickId];
  if (!skin) throw new Error(`[buildings] Missing BUILDING_SKINS entry for id=${pickId}`);

  return skin;
}
```

### Hard rule (updated)
No other file is allowed to define or override:
- `w`, `h`, `heightUnits`
- `anchorLiftUnits`, `wallLiftUnits`, `roofLiftUnits`, `spriteScale`
- `offsetPx`, `anchorOffsetPx`
- `slice.*`

All code must treat `BuildingSkin` returned from `buildings.ts` as authoritative.

---

## A2) Decide building pack per map (exactly one mechanism)
We need a single explicit method to determine the pack for a map.

Choose ONE:

### Option 1 (preferred): JSON map carries `buildingPackId`
- Add optional `buildingPackId?: BuildingPackId` to the JSON map schema.
- Example:
  - Avenue: `"buildingPackId": "avenue_buildings"`
  - China town: `"buildingPackId": "china_town_buildings"`

### Option 2: Resolver based on map id
- `resolveBuildingPackForMap(mapId): BuildingPackId`
- Centralize logic in one resolver module.

**Hard rule:** Only one of these approaches exists.

---

# Part B — Hook Semantic Building Areas into Building Builder Pipeline

## B1) Semantic input
We assume authored maps already produce semantic areas like:
- `{ type: "building", x, y, w, h }`

Wherever we compile map fields → runtime entities/surfaces, ensure the building builder receives:
- Tile rectangle: `x, y, w, h`
- Current map’s `buildingPackId`
- `RNG`

## B2) Builder placement behavior
For each semantic building rectangle:
- Choose candidate skins using `pickBuildingSkin(rng, buildingPackId)`
- Fit/place buildings using **only** `skin.w`/`skin.h` from `buildings.ts`
- Emit runtime **structure/building entities** (not props)

Minimum acceptable behavior:
- Place **1 building** if it fits within the rectangle.

If the builder already supports multi‑building filling:
- Keep it, but dimensions must come from `BuildingSkin` only.

---

# Part C — Remove Old Sliced‑Building Pipeline

## C1) Delete old sliced assets
Delete building sprite folders/files that exist only for the deprecated sliced pipeline.

- Remove folders like:
  - `src/assets/**/sliced/**`
  - any legacy `buildings/**` slice-only assets not referenced by `buildings.ts`

If some files share names with the new piece-based building skins (`wallSouth`/`wallEast`), keep only those referenced in `BUILDING_SKINS`.

## C2) Delete old sliced building code paths
Remove:
- any loader/resolver path that loads “sliced building sprite sheets” for buildings
- any “full sprite building render pipeline” if it bypasses structure/building placement

After removal:
- Buildings must render via the structure/building path using `BuildingSkin` definitions.

---

# Part D — Refactor Test Buildings from Props → Structures/Buildings

## D1) Move assets into structure packs
Move building-like assets out of props folders and into:

- `src/assets/structures/buildings/avenue/...`
- `src/assets/structures/buildings/china_town/...`

Rules:
- Avenue-only art → `/avenue/`
- China-town-only art → `/china_town/`
- No buildings remain under any `props` folder.

## D2) Remove prop entries for buildings
- Remove `propId` entries for buildings from:
  - `src/game/content/props.ts` (or equivalent)
  - any prop resolvers/loaders
- If maps currently place buildings as props, migrate them to semantic building areas.

---

# Part E — Renderer Expectations (Minimum)
- Renderer loads sprites referenced by `buildings.ts` only.
- Renderer applies:
  - `offsetPx` / `anchorOffsetPx` when computing draw positions
  - `slice.*` only if runtime slicing / slice ordering is enabled for that skin
- No other module may introduce ad-hoc offsets for specific building ids.

---

# Achievements
- [x] Semantic building areas trigger building placement through the building builder pipeline.
- [x] Each map uses a per‑map building pack (`avenue_buildings` vs `china_town_buildings`).
- [x] `buildings.ts` is the only place containing building size/height + all tuning (offset and slicing).
- [x] Test buildings are no longer props; they are structures/buildings selected via packs.
- [x] Old sliced‑building pipeline is fully removed (assets + code paths).
- [x] No module hardcodes building dimensions/offsets/slice values (all read from `buildings.ts`).

---

# Definition of Done Smoke Tests
1) **Avenue map** with one semantic building area places a building from `avenue_buildings`.
2) **China town map** places a building from `china_town_buildings`.
3) No warnings/errors about missing legacy “sliced building” assets.
4) No buildings appear via the prop pipeline.
5) Changing a building’s `offsetPx` or `slice.stepPx` in `buildings.ts` affects rendering immediately without any other code changes.
