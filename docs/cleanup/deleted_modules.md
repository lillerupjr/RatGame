# Deleted Modules Log

## 2026-03-04

- `src/game/map/proceduralMapBridge.ts`
  - Removed legacy bridge that mixed procedural generation and activation.
  - Replaced by authored-only activation module.

- `src/game/map/generators/proceduralMap.ts`
  - Removed procedural floor generation runtime path.

- `src/game/map/generators/mazeMap.ts`
  - Removed procedural maze generation runtime path.

- `src/game/map/runMap.ts`
  - Removed legacy RunMap progression graph; Delve is the only progression authority.

- `src/game/map/floorMapSourceBinding.ts`
  - Removed legacy map-source switching with procedural variants.

- `src/game/map/compile/LayeredTileMap3D.ts`
  - Removed Option A layered map compile experiment from runtime path.

- `src/game/map/compile/Pathfinding3D.ts`
  - Removed Option A pathfinding companion module.

- `src/game/content/upgrades.ts`
  - Removed unused legacy content module.

- `src/game/content/weapons.ts`
  - Removed legacy weapon catalog after migrating runtime authority to combat_mods starter/registry paths.

- `src/tests/game/map/generators/proceduralMap.test.ts`
  - Removed procedural generator test suite tied to deleted runtime modules.
