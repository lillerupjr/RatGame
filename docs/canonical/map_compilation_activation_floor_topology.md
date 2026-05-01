# Map Compilation / Activation / Floor Topology

## Purpose

Own the conversion from authored map definitions and selected floor intents into the active compiled floor topology used by runtime systems: authored loading, map activation, compiled query surfaces, and row/lane floor routing.

## Scope

- Authored JSON/table map loading into `TableMapDef`; chunk-grid expansion; registry lookup
- Compilation to `CompiledKenneyMap`
- Active map ownership in `src/game/map/authoredMapActivation.ts` and `src/game/map/compile/kenneyMap.ts`
- Spawn/goal, tile/surface/road/blocked queries, view-filtered map accessors
- `DelveMap` generation/transitions; `FloorIntent` construction; objective/map binding
- Topology-derived overlays for vendor/heal/rare-zone triggers

## Non-scope

- Entity simulation after floor load: `docs/canonical/core_simulation_combat_runtime.md`
- Rendering internals that consume compiled queries: `docs/canonical/presentation_rendering_pipeline.md`
- Trigger/objective/reward execution after defs exist: `docs/canonical/progression_objectives_rewards.md`
- World construction/lifecycle beyond spawn/topology inputs: `docs/canonical/world_state_runtime_data_model.md`
- Route-map UI layout/rendering: `docs/canonical/ui_shell_menus_runtime_panels.md`

## Entrypoints

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

## Pipeline

1. **Authored Load**: `AUTHORED_MAP_DEFS` eager-imports authored JSON via `authoredMapRegistry.ts`. `loadTableMapDefFromJson()` validates JSON and produces `TableMapDef`; chunk grids may stitch chunks, add ocean borders, and preserve cells, stamps, road rects, lights, and authored `objectiveDefs`.
2. **Floor Topology**: `createDelveMap(seed, config)` normalizes config, builds row/lane layouts and adjacent-row edges, validates connectivity, and assigns node plans carrying `zoneId`, `mapId`, `objectiveId`, `variantSeed`, optional `bossId`. Deterministic path-select mode skips `DelveMap` and derives a one-row route in `game.ts` / `routeMapView.ts`.
3. **Floor Intent**: `moveToNode()` records pending selection. `buildFloorIntentFromDelveNode()`, `buildDeterministicFloorIntent()`, or `buildFallbackFloorIntent()` creates `FloorIntent` with node/stage/zone/depth/floor index/archetype/map/objective/boss ids/variant seed/placement params.
4. **Objective Binding**: `applyObjective()` shallow-clones `TableMapDef` and replaces `objectiveDefs` for the selected `ObjectiveId`; `objectiveSpecFromFloorIntent()` independently derives runtime spec from the same `FloorIntent`.
5. **Activation**: `beginFloorLoad()` resolves base map, applies objective transforms, then calls `activateMapDefAsync(finalMap, variantSeed)`. `activateMapDef*()` clears `canvasGroundChunkCacheStore`, delegates to `setActiveMap*()`, stores active authored and compiled maps, and updates active render skin id.
6. **Compile**: `setActiveMapAsync()` performs required monolithic semantic prepass, asserts completeness, compiles, and clears ramp cache. `compileKenneyMapFromTable()` outputs `CompiledKenneyMap`. Monolithic placement resolves semantic geometry per skin/sprite before oriented footprint size and SE-anchor placement; it does not read authored skin `w`/`h`/`heightUnits` directly. Structure geometry details live in `docs/canonical/structure_geometry_slicing_system.md`.
7. **Compiled Output / Queries**: compiled map includes origin, dimensions, spawn/goal, `IsoTile`, surfaces/tops by layer, face pieces, occluders, overlays, decals, `bossSpawn`, lights, trigger defs, blocked tiles/spans, tile heights, road masks/markings, occlusion geometry. `kenneyMap.ts` exposes active compiled queries; `authoredMapActivation.ts` exposes active authored map, safe spawn/goal, walkability/stairs/height checks, map stats, ASCII debug export.
8. **Overlay Placement**: `applyFloorOverlays()` reads active compiled map and spawn tile, flood-fills reachable tiles with connector-aware height transitions, chooses centers by `LONGEST_PATH` or `STATIC_POINTS`, and writes trigger defs into `world.overlayTriggerDefs`.

## Invariants

- `TableMapDef` is authored input; `CompiledKenneyMap` is runtime topology output.
- `AUTHORED_MAP_DEFS` is eager and sorted by `id`.
- `activateMapDef*()` clears `canvasGroundChunkCacheStore` before switching maps.
- `setActiveMapAsync()` performs required monolithic semantic prepass; sync `setActiveMap()` assumes it is already available.
- `setActiveMap*()` replaces active compiled map and clears `_rampCache`.
- Monolithic compile placement uses semantic placement geometry, not legacy authored dimensions.
- `authoredMapActivation.ts` may have `activeMap === null`; `compile/kenneyMap.ts` boots non-null with `EMPTY_BOOT`.
- Safe spawn clamps to active bounds and rejects `STAIRS`.
- `spawnTx`/`spawnTy` are always present; `goalTx`/`goalTy` may be `null`.
- `createDelveMap()` produces a final row with exactly one boss node.
- Delve edges connect adjacent rows and never jump more than one lane.
- `moveToNode()` only records `pendingNodeId`; `commitPendingNode()` commits.
- `markCurrentNodeCleared()` marks current node complete, not next-node choice.
- `applyObjective()` only replaces `objectiveDefs` on a returned map clone.
- `applyFloorOverlays()` derives placements from active-map reachable topology starting at spawn.

## Constraints

- One active `CompiledKenneyMap` remains authoritative; no parallel floor-topology stores.
- Activation must go through `activateMapDef*()` / `setActiveMap*()` to keep cache clearing, semantic prepass, authored map, and render skin synchronized.
- Floor selection authority is `FloorIntent` plus pending/commit flow; route clicks must not directly mutate committed floor state.
- Compiled surfaces/layers/blocked/roads/occlusion are derived outputs, not hand-maintained topology.
- Overlay placements must come from active reachable geometry, not hardcoded coordinates.

## Dependencies

### Incoming

- Authored JSON maps under `src/game/map/authored/maps/jsonMaps`
- Content registries: map skins, building packs/skins, props, floor/decal config
- Monolithic semantic prepass helpers
- Loading/profiler hooks from `src/game/app/loadingFlow.ts`
- Objective-spec conversion helpers
- Run/floor selection inputs from `src/game/game.ts`

### Outgoing

- Active compiled queries to render, objectives, bosses, pathfinding/flow fields, neutral/hostile placement, debug overlays
- Active authored objective defs to progression setup via `applyObjectivesFromActiveMap()`
- Overlay trigger defs for progression trigger instantiation
- Floor-route state to game runtime and route-map UI

## Extension

- `TableMapDef`, `TableMapCell`, semantic-stamp schema
- `loadTableMapDefFromJson()`
- `compileKenneyMapFromTable()`
- `CompiledKenneyMap` queries and wrappers in `kenneyMap.ts`
- `DelveMapConfig` and `createDelveMap()` node planning
- `FloorIntent`
- `objectiveIdFromArchetype()`, `objectiveSpecFromFloorIntent()`, `applyObjective()`
- Overlay policies: `LONGEST_PATH`, `STATIC_POINTS`

## Failure Modes

- Low-level compiled-map mutation without `activateMapDef*()` desyncs authored map, skin, and cache invalidation.
- Sync `setActiveMap()` without needed semantic prepass can trip assertions.
- `authoredMapActivation.getActiveMap()` and `compile/kenneyMap.getActiveMap()` have different nullability.
- Authored spawn may be unsafe; helpers can relocate to nearest walkable non-stairs tile.
- Skipping `commitPendingNode()` after route selection can fail floor load and reopen delve map.
- Hardcoded overlay placements can be unreachable.
- Mutating compiled query outputs mixes derived topology with authored input.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
