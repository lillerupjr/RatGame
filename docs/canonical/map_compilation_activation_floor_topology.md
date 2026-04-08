# Map Compilation / Activation / Floor Topology

## Purpose

- Transform authored map definitions and selected floor intents into the active compiled floor topology used by runtime systems.
- Own authored map loading, active-map activation, compiled spatial query surfaces, and the row/lane floor-topology model that decides which floor loads next.

## Scope

- Authored map definition loading and normalization into `TableMapDef`
- Chunk-grid expansion and authored-map registry lookup
- Compilation from `TableMapDef` into `CompiledKenneyMap`
- Active-map ownership in:
  - `src/game/map/authoredMapActivation.ts`
  - `src/game/map/compile/kenneyMap.ts`
- Spawn/goal resolution, tile/surface/road/blocked-tile query helpers, and view-filtered compiled-map accessors
- Floor-topology generation and state transitions via `DelveMap`
- Floor-intent construction and objective/map binding for selected floors
- Topology-derived overlay placement for floor triggers such as vendor/heal/rare-zone placements

## Non-scope

- Gameplay simulation that moves entities across the map after a floor is loaded
- Rendering internals that consume compiled-map queries
- Trigger execution, objective progression, and reward resolution after trigger defs are instantiated
- World construction and lifecycle beyond this system supplying spawn/topology inputs
- Route-map UI layout/rendering details such as SVG path layout and scroll behavior

## Key Entrypoints

- `src/game/map/authored/authoredMapRegistry.ts`
- `src/game/map/formats/json/jsonMapLoader.ts`
- `src/game/map/formats/table/tableMapTypes.ts`
- `src/game/map/compile/kenneyMapLoader.ts`
- `src/game/map/compile/kenneyMap.ts`
- `src/game/map/authoredMapActivation.ts`
- `src/game/map/delveMap.ts`
- `src/game/map/routeMapView.ts`
- `src/game/map/floorIntent.ts`
- `src/game/map/objectivePlan.ts`
- `src/game/map/objectiveTransforms.ts`
- `src/game/map/floorObjectiveBinding.ts`
- `src/game/map/floorOverlays.ts`
- `src/game/map/reachablePlacements.ts`
- `src/game/game.ts`

## Data Flow / Pipeline

1. **Authored Map Definition Load**
   - `AUTHORED_MAP_DEFS` is built by eager-importing authored JSON maps through `authoredMapRegistry.ts`.
   - `loadTableMapDefFromJson()` validates structured JSON input and converts it into `TableMapDef`.
   - JSON loading can:
     - expand `chunkGrid` maps into stitched `TableMapDef` output
     - add ocean-border chunks around chunk grids
     - preserve authored cells, stamps, road semantic rects, lights, and map-authored `objectiveDefs`

2. **Floor-Topology Generation**
   - `createDelveMap(seed, config)` normalizes delve config, builds row/lane layouts, generates adjacent-row edges, validates connectivity, and assigns node runtime plans.
   - Each generated node runtime plan carries the data needed to enter a floor:
     - `zoneId`
     - `mapId`
     - `objectiveId`
     - `variantSeed`
     - optional `bossId`
   - Deterministic path-select mode skips `DelveMap` generation and instead derives a one-row route from fixed choices in `src/game/game.ts` and `src/game/map/routeMapView.ts`.

3. **Floor Selection -> Floor Intent**
   - `moveToNode()` records a pending delve-node selection.
   - `buildFloorIntentFromDelveNode()`, `buildDeterministicFloorIntent()`, or `buildFallbackFloorIntent()` converts the selected route option into a `FloorIntent`.
   - `FloorIntent` carries the load-time floor contract:
     - node identity
     - stage/zone
     - depth and floor index
     - floor archetype
     - resolved map/objective/boss ids
     - variant seed and optional placement parameters

4. **Objective / Map Binding**
   - `applyObjective()` creates a shallow-cloned `TableMapDef` whose `objectiveDefs` are derived from the selected `ObjectiveId`.
   - `objectiveSpecFromFloorIntent()` separately derives the runtime objective spec from the same `FloorIntent`, using explicit floor-intent parameters when present.

5. **Map Activation**
   - `beginFloorLoad()` in `src/game/game.ts` resolves the base authored map, applies objective transforms, and calls `activateMapDefAsync(finalMap, variantSeed)`.
   - `activateMapDef()` / `activateMapDefAsync()`:
     - clear `canvasGroundChunkCacheStore`
     - delegate compilation to `setActiveMap()` / `setActiveMapAsync()`
     - store the authored active map def
     - store the compiled active map
     - update the active render skin id

6. **Compilation Into Runtime Topology**
   - `setActiveMapAsync()` computes required monolithic-building semantic prepass data, asserts completeness, compiles the map, and clears the ramp cache.
   - `compileKenneyMapFromTable()` converts `TableMapDef` into `CompiledKenneyMap`.
   - Monolithic building placement during compile does not read authored `w` / `h` / `heightUnits` from building skins directly.
   - Instead, compile resolves semantic placement geometry per skin/sprite through the monolithic semantic prepass layer before choosing oriented footprint size and final SE-anchor placement.
   - The compiled map includes:
     - origin, width, height, spawn, and optional goal
     - per-tile `IsoTile` access
     - surfaces and tops by logical layer
     - face pieces, occluders, overlays, and decals
     - semantic data such as `bossSpawn`
     - static light defs and trigger defs
     - blocked tiles and blocked-tile spans
     - tile-height grid
     - road masks, widths, and generated road markings
     - occlusion geometry

7. **Runtime Topology Query Surface**
   - `src/game/map/compile/kenneyMap.ts` exposes the active compiled map through helpers for:
     - tile kind / semantic / height lookups
     - surface stacks and world-space surface hits
     - layer enumeration and view-rect queries
     - blocked-tile and road-mask queries
     - walk-shape and walk-info queries
   - `src/game/map/authoredMapActivation.ts` exposes authored-active-map helpers for:
     - active authored map def access
     - safe spawn and goal world coordinates
     - walkability / stairs / height checks
     - map stats and ASCII debug export

8. **Topology-Derived Overlay Placement**
   - `applyFloorOverlays()` reads the active compiled map plus the active spawn tile.
   - `collectReachableTiles()` flood-fills reachable tiles from spawn using walk-info and connector-aware height transitions.
   - Overlay placement then chooses centers through:
     - longest-path placement, or
     - static farthest-first placement
   - The resulting trigger defs are written into `world.overlayTriggerDefs` for later progression-system instantiation.

## Core Invariants

- `TableMapDef` is the authored compile input for this system.
- `CompiledKenneyMap` is the runtime spatial/topology output contract for this system.
- `AUTHORED_MAP_DEFS` is built eagerly and sorted by `id`.
- `activateMapDef()` and `activateMapDefAsync()` clear `canvasGroundChunkCacheStore` before switching maps.
- `setActiveMapAsync()` performs required monolithic semantic prepass work before compiling the map.
- `setActiveMap()` assumes required monolithic semantic prepass data is already available.
- `setActiveMap()` and `setActiveMapAsync()` replace the active compiled map and clear `_rampCache`.
- Monolithic building compile placement must resolve through semantic placement geometry (computed or fallback) rather than legacy authored building dimensions.
- `authoredMapActivation.ts` can have `activeMap === null` before activation.
- `src/game/map/compile/kenneyMap.ts` always has a non-null compiled map because it boots with `EMPTY_BOOT`.
- Safe spawn resolution clamps to active-map bounds and rejects `STAIRS` even if the authored spawn tile is unsafe.
- `CompiledKenneyMap.spawnTx` / `spawnTy` are always present; `goalTx` / `goalTy` may be `null`.
- `createDelveMap()` always produces a final row with exactly one boss node.
- Delve edges connect only adjacent rows and never jump more than one lane sideways.
- `moveToNode()` only records `pendingNodeId`; `commitPendingNode()` is the transition that makes a node current.
- `markCurrentNodeCleared()` marks the current node complete but does not choose the next node.
- `applyObjective()` only changes the authored map by replacing `objectiveDefs` on the returned map clone.
- `applyFloorOverlays()` derives placements from reachable topology on the active map, starting from spawn.

## Design Constraints

- The active playable floor must remain authoritative through one active `CompiledKenneyMap`; systems must not create competing authoritative floor-topology stores.
- Runtime map activation must go through `activateMapDef*()` / `setActiveMap*()` so cache clearing, semantic prepass, active authored-map state, and render-skin state remain synchronized.
- Floor selection must remain authoritative through `FloorIntent` plus the delve-node pending/commit flow; node advancement must not skip directly from route click to committed floor state.
- Compiled-map query data such as surfaces, layers, blocked tiles, road masks, and occlusion geometry are derived compile outputs and must not become hand-maintained parallel topology state.
- Topology-derived overlay placements must be derived from the active map’s reachable geometry, not from map-independent hardcoded coordinates.

## Dependencies (In/Out)

### Incoming

- Authored JSON map files under `src/game/map/authored/maps/jsonMaps`
- Content registries used during compilation, including:
  - map skins
  - building packs/skins
  - prop definitions
  - runtime floor/decal config
- Monolithic-building semantic prepass helpers
- Loading/profiler hooks from `src/game/app/loadingFlow.ts`
- Objective-spec conversion from progression objective-spec helpers
- Run/floor selection inputs from `src/game/game.ts`

### Outgoing

- Active compiled-map queries consumed by:
  - presentation/render systems
  - objective systems
  - boss systems
  - pathfinding / flow-field helpers
  - neutral and hostile placement logic
  - debug overlays
- Active authored-map objective defs pushed into progression setup through `applyObjectivesFromActiveMap()`
- Overlay trigger defs later instantiated by the progression trigger system
- Floor-route state consumed by the game runtime and route-map UI

## Extension Points

- `TableMapDef`, `TableMapCell`, and semantic-stamp schema
- `loadTableMapDefFromJson()`
- `compileKenneyMapFromTable()`
- `CompiledKenneyMap` query surface and wrapper helpers in `src/game/map/compile/kenneyMap.ts`
- `DelveMapConfig` and node-runtime planning in `createDelveMap()`
- `FloorIntent`
- Objective binding / transform helpers:
  - `objectiveIdFromArchetype()`
  - `objectiveSpecFromFloorIntent()`
  - `applyObjective()`
- Overlay placement policies:
  - `LONGEST_PATH`
  - `STATIC_POINTS`

## Failure Modes / Common Mistakes

- Bypassing `activateMapDef*()` and mutating only the low-level compiled map leaves authored active-map state, skin state, and cache invalidation out of sync.
- Using sync `setActiveMap()` for a map that needs monolithic semantic prepass data can trip semantic-prepass assertions during compile.
- Treating `authoredMapActivation.getActiveMap()` and `compile/kenneyMap.getActiveMap()` as the same nullability contract is incorrect.
- Assuming the authored spawn tile is always usable is incorrect; spawn helpers can relocate to the nearest walkable non-stairs tile.
- Skipping `commitPendingNode()` after route selection can cause floor load to fail and reopen the delve map.
- Hardcoding overlay placements without reachable-topology checks can produce unreachable vendor/heal/rare-zone placements.
- Mutating compiled query outputs as if they were persistent authored data mixes derived runtime topology with authored input state.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
