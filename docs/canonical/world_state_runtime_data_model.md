# World State / Runtime Data Model

## Purpose

- Define the canonical mutable runtime object used by gameplay, progression, and presentation code.
- Store persistent run state, floor state, player state, entity state, per-frame event queues, and cross-system runtime registries in one shared data model.

## Scope

- `World`, `GameState`, `RunState`, and related runtime types in `src/engine/world/world.ts`
- Construction of a new world via `createWorld()`
- The helper API exported by `src/engine/world/world.ts`:
  - `gridAtPlayer()`
  - `clearEvents()`
  - `emitEvent()`
- The storage layout of:
  - player state
  - run/floor state
  - trigger/objective state
  - enemy, zone, projectile, pickup, and VFX runtime state
  - event queues and metrics

## Non-scope

- The app-level bootstrap and frame loop in `src/main.ts`
- Pause/menu/loading orchestration owned by the Game Runtime / App Loop system
- The logic of gameplay systems that mutate the world during `game.update()`
- Rendering logic that consumes world state during `game.render()`
- Map compilation and authored map activation logic, except where this module reads spawn data during construction

## Key Entrypoints

- `src/engine/world/world.ts`
- `src/game/events.ts`
- `src/game/factories/enemyFactory.ts`
- `src/game/hostiles/hostileActorFactory.ts`
- `src/game/factories/projectileFactory.ts`
- `src/game/factories/zoneFactory.ts`
- `src/game/stats/derivedStats.ts`
- `src/game/systems/sim/momentum.ts`
- `src/game/map/compile/kenneyMap.ts`

## Data Flow / Pipeline

1. **World Construction**
   - `createWorld({ seed, stage })` creates a new `RNG`, clones the provided `StageDef`, and allocates a fresh `World` object.
   - The new world starts with:
     - `state = "MENU"`
     - `runState = "FLOOR"`
     - empty runtime arrays and queues
     - initialized nested runtime objects such as `run`, `lighting`, `timeState`, `camera`, `deathFx`, `bossRuntime`, and `metrics`

2. **Initial Spawn Anchoring**
   - During construction, `createWorld()` calls `getSpawnWorld(KENNEY_TILE_WORLD)`.
   - The returned spawn position is converted through `anchorFromWorld()` and written into the player anchor fields:
     - `pgxi`
     - `pgyi`
     - `pgox`
     - `pgoy`
   - The same spawn result initializes:
     - `pz`
     - `pzVisual`
     - `pzLogical`
     - `activeFloorH`

3. **Derived-Stat Normalization**
   - `createWorld()` calls `recomputeDerivedStats(w)` before returning the world.
   - Derived player values such as speed, armor caps, momentum caps, damage multipliers, and fire-rate multipliers are normalized from base values and inventory state.

4. **Shared Runtime Consumption**
   - The `World` object is then passed through the rest of the runtime.
   - Systems mutate the same object directly rather than producing copies.

5. **Entity Storage Model**
   - The player is stored as direct scalar fields on `World`.
   - Entity families are stored as family-local parallel arrays:
     - enemies: `e*`
     - zones: `z*`
     - projectiles: `pr*` / `pAlive`
     - pickups: `x*`
     - VFX: `vfx*`
   - Factory code appends aligned entries for each family by pushing into every required array at the same index.

6. **Coordinate Model**
   - Player, enemies, zones, projectiles, and pickups use anchor-based grid-authoritative position storage:
     - integer component: `*gxi`, `*gyi`
     - offset component: `*gox`, `*goy`
   - `gridAtPlayer()` reconstructs player logical grid position from the player anchor fields.

7. **Event Model**
   - `emitEvent()` appends `GameEvent` values into `world.events`.
   - `clearEvents()` truncates `world.events` only.
   - `world.eventQueue` is a separate queue used by the momentum system for internal proc-state transitions and is cleared by `processMomentumEventQueue()`, not by `clearEvents()`.

## Core Invariants

- `createWorld()` returns a fresh mutable object with all array-backed runtime stores initialized.
- `createWorld()` clones the incoming `StageDef`; the stored `world.stage` is not the original input object.
- `world.runSeed` is the provided seed or `1337` if no seed is passed.
- `world.stageId` is initialized from the cloned stage’s `id`.
- `world.run.level` and `world.level` both start at `1`.
- `world.run.xpToNextLevel` starts from `getSettings().system?.xpLevelBase` or `DEFAULT_XP_LEVEL_BASE`.
- `recomputeDerivedStats(w)` runs before `createWorld()` returns.
- Player position is anchor-based and grid-authoritative; `gridAtPlayer()` derives its output from `pgxi`, `pgyi`, `pgox`, and `pgoy`.
- Enemy, zone, projectile, pickup, and VFX runtime state is family-local and index-based.
- For array-backed entity families, the corresponding alive array gates slot activity:
  - enemies: `eAlive`
  - zones: `zAlive`
  - projectiles: `pAlive`
  - pickups: `xAlive`
  - VFX: `vfxAlive`
- Factory code for enemies, projectiles, and zones appends aligned fields at the same family index.
- `emitEvent()` writes to `world.events`, not `world.eventQueue`.
- `clearEvents()` clears `world.events`, not:
  - `world.eventQueue`
  - `world.triggerSignals`
  - `world.objectiveEvents`
- `world.runState` models floor/run progression (`"FLOOR"`, `"TRANSITION"`, `"RUN_COMPLETE"`, `"GAME_OVER"`), not app pause state.

## Design Constraints

- `World` is the shared canonical runtime state object for gameplay, progression, and presentation code; parallel competing runtime state stores must not become authoritative without updating this document.
- Array-backed entity families must preserve index alignment within each family.
- Anchor-based grid-authoritative position storage is the canonical position model for the player and the core entity families stored here.
- Gameplay/audio/VFX event emission must use `world.events` via `emitEvent()` unless this document is updated.
- `world.eventQueue` remains a separate internal queue and must not be treated as a general replacement for `world.events`.

## Dependencies (In/Out)

### Incoming

- `StageDef` input passed to `createWorld()`
- Seed input passed to `createWorld()`
- Spawn data from `getSpawnWorld(KENNEY_TILE_WORLD)` in `src/game/map/compile/kenneyMap.ts`
- Settings data from `getSettings()` during initial XP-threshold setup
- Derived-stat normalization from `recomputeDerivedStats()`
- `GameEvent` type definitions from `src/game/events.ts`

### Outgoing

- Consumed broadly by:
  - simulation systems
  - progression systems
  - enemy/boss runtime systems
  - rendering/presentation systems
  - UI/HUD rendering paths
- Appended to by factory modules such as:
  - hostile actor / enemy factories
  - projectile factory
  - zone factory
- Read by coordinate and targeting helpers through `gridAtPlayer()`
- Used as the backing store for event distribution through `emitEvent()`

## Extension Points

- The `World` type and related runtime types in `src/engine/world/world.ts`
- `createWorld()` default initialization
- `GameEvent` in `src/game/events.ts`
- Entity-family factories that append aligned data:
  - `spawnHostileActorGrid()`
  - `spawnProjectile()`
  - `spawnZone()`
- Cross-system helper API:
  - `gridAtPlayer()`
  - `emitEvent()`
  - `clearEvents()`

## Failure Modes / Common Mistakes

- Confusing app pause with `world.runState` is incorrect; app pause is controlled by `AppStateController`, not by `World.RunState`.
- Appending to one array in an entity family without appending the corresponding peer arrays breaks family index alignment.
- Reading entity family data without checking the corresponding alive array can target inactive slots.
- Writing normal gameplay/audio/VFX events into `world.eventQueue` bypasses the `emitEvent()` path; `eventQueue` is a separate internal queue.
- Expecting `clearEvents()` to clear all transient runtime queues is incorrect; it only clears `world.events`.
- Assuming derived player stats remain at constructor literals is incorrect; `recomputeDerivedStats()` rewrites derived values during world creation.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
