# World State / Runtime Data Model

## Purpose

Define the shared mutable `World` runtime object used by gameplay, progression, presentation, and UI readers: persistent run/floor/player/entity state, event queues, metrics, and cross-system registries.

## Scope

- `World`, `GameState`, `RunState`, related types in `src/engine/world/world.ts`
- `createWorld()`
- Helper API: `gridAtPlayer()`, `clearEvents()`, `emitEvent()`
- Storage layout for player, run/floor, trigger/objective, enemies, zones, projectiles, pickups, VFX, events, metrics

## Non-scope

- App bootstrap/frame loop and pause/menu/loading orchestration: `docs/canonical/game_runtime_app_loop.md`
- Gameplay systems mutating world in `game.update()`: `docs/canonical/core_simulation_combat_runtime.md`
- Rendering consuming world in `game.render()`: `docs/canonical/presentation_rendering_pipeline.md`
- Map compilation/activation beyond spawn read during construction: `docs/canonical/map_compilation_activation_floor_topology.md`

## Entrypoints

- `src/engine/world/world.ts`
- `src/game/events.ts`
- `src/game/factories/enemyFactory.ts`
- `src/game/hostiles/hostileActorFactory.ts`
- `src/game/factories/projectileFactory.ts`
- `src/game/factories/zoneFactory.ts`
- `src/game/stats/derivedStats.ts`
- `src/game/systems/sim/momentum.ts`
- `src/game/map/compile/kenneyMap.ts`

## Pipeline

1. **Construction**: `createWorld({ seed, stage })` creates `RNG`, clones `StageDef`, allocates fresh `World` with `state = "MENU"`, `runState = "FLOOR"`, empty arrays/queues, and nested runtime objects (`run`, `lighting`, `timeState`, `camera`, `deathFx`, `bossRuntime`, `metrics`).
2. **Initial Spawn**: `createWorld()` calls `getSpawnWorld(KENNEY_TILE_WORLD)`, converts to anchor via `anchorFromWorld()`, writes `pgxi`, `pgyi`, `pgox`, `pgoy`, and initializes `pz`, `pzVisual`, `pzLogical`, `activeFloorH`.
3. **Derived Stats**: `recomputeDerivedStats(w)` runs before return, normalizing speed, armor caps, momentum caps, damage/fire-rate multipliers, etc. from base values and inventory.
4. **Runtime Consumption**: systems mutate the same `World` object directly rather than producing copies.
5. **Entity Storage**: player is scalar fields. Families are local parallel arrays: enemies `e*`, zones `z*`, projectiles `pr*`/`pAlive`, pickups `x*`, VFX `vfx*`. Factories append aligned entries at the same family index.
6. **Coordinates**: player/enemies/zones/projectiles/pickups use anchor-backed grid-authoritative positions with integer `*gxi`/`*gyi` and offset `*gox`/`*goy`. `gridAtPlayer()` reconstructs player grid position from anchors.
7. **Events**: `emitEvent()` appends to `world.events`; `clearEvents()` truncates only `world.events`. `world.eventQueue` is separate momentum internal proc-state queue cleared by `processMomentumEventQueue()`.

## Invariants

- `createWorld()` returns a fresh object with initialized array-backed stores.
- Input `StageDef` is cloned; stored `world.stage` is not the original.
- `world.runSeed` is provided seed or `1337`; `world.stageId` comes from cloned stage id.
- `world.run.level` and `world.level` start at `1`.
- `world.run.xpToNextLevel` starts from `getSettings().system?.xpLevelBase` or `DEFAULT_XP_LEVEL_BASE`.
- `recomputeDerivedStats(w)` runs before constructor return.
- Player position is anchor-based and grid-authoritative.
- Enemy/zone/projectile/pickup/VFX families are index-based and gated by alive arrays: `eAlive`, `zAlive`, `pAlive`, `xAlive`, `vfxAlive`.
- Enemy/projectile/zone factories append aligned family fields at one index.
- `emitEvent()` writes to `world.events`, not `world.eventQueue`.
- `clearEvents()` clears only `world.events`, not `world.eventQueue`, `world.triggerSignals`, or `world.objectiveEvents`.
- `world.runState` models floor/run progression (`"FLOOR"`, `"TRANSITION"`, `"RUN_COMPLETE"`, `"GAME_OVER"`), not app pause.

## Constraints

- `World` is canonical shared runtime state; parallel authoritative runtime stores require doc updates.
- Array-backed families must preserve index alignment.
- Anchor-backed grid-authoritative position is canonical for player and core entity families.
- Gameplay/audio/VFX events use `emitEvent()` / `world.events` unless this doc changes.
- `world.eventQueue` remains momentum-internal, not a replacement event stream.

## Dependencies

### Incoming

- `StageDef` and seed passed to `createWorld()`
- Spawn from `getSpawnWorld(KENNEY_TILE_WORLD)`
- Settings from `getSettings()` for XP threshold
- Derived-stat normalization from `recomputeDerivedStats()`
- `GameEvent` definitions from `src/game/events.ts`

### Outgoing

- Consumed by simulation, progression, enemy/boss runtime, presentation, UI/HUD
- Appended by hostile/enemy, projectile, and zone factories
- Read by coordinate/target helpers through `gridAtPlayer()`
- Event backing store through `emitEvent()`

## Extension

- `World` and related types in `src/engine/world/world.ts`
- `createWorld()` defaults
- `GameEvent` in `src/game/events.ts`
- Aligned factories: `spawnHostileActorGrid()`, `spawnProjectile()`, `spawnZone()`
- Helper API: `gridAtPlayer()`, `emitEvent()`, `clearEvents()`

## Failure Modes

- Confusing app pause with `world.runState`; pause belongs to `AppStateController`.
- Partial family-array append breaks index alignment.
- Reading inactive slots without alive checks targets stale data.
- Writing public events to `world.eventQueue` bypasses `emitEvent()`.
- Expecting `clearEvents()` to clear all transient queues is wrong.
- Assuming derived stats equal constructor literals ignores `recomputeDerivedStats()`.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
