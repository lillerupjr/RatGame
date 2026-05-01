# Hostile AI / Spawn Runtime

## Purpose

Own non-boss hostile behavior, auto-spawn pacing, spawn request execution, and hostile action side effects. Convert enemy content, floor pacing state, and per-enemy brain state into behavior transitions, spawn requests, live enemy slots, and action mutations.

## Scope

- Hostile brain and spawn runtime fields in `src/engine/world/world.ts`
- Floor-entry reset and update order in `src/game/game.ts`
- Enemy content/factories: `src/game/content/enemies.ts`, `src/game/factories/enemyFactory.ts`, `src/game/hostiles/hostileActorFactory.ts`
- Brain/behavior/action/runtime scaling: `src/game/systems/enemies/brain.ts`, `behavior.ts`, `actions.ts`, `finalize.ts`, `enemyRuntime.ts`
- Spawn director/config/debug, execution, placement: `src/game/systems/spawn/hostileSpawnDirector.ts`, `hostileSpawnExecution.ts`, `spawn.ts`

## Non-scope

- Locomotion, collision, projectile runtime, contact damage: `docs/canonical/core_simulation_combat_runtime.md`
- Boss spawning/phases/abilities: `docs/canonical/boss_encounter_system.md`
- Neutral monster runtime except explicit exclusion from hostile pacing
- Objective-authored population/scripted spawns except reused hooks: `docs/canonical/progression_objectives_rewards.md`
- Reward/drop/gold/xp/trigger outcomes after kills: `docs/canonical/progression_objectives_rewards.md`
- Rendering/audio/debug UI consumption: `docs/canonical/presentation_rendering_pipeline.md`, `docs/canonical/ui_shell_menus_runtime_panels.md`

## Entrypoints

- `src/engine/world/world.ts`
- `src/game/game.ts`
- `src/game/content/enemies.ts`
- `src/game/factories/enemyFactory.ts`
- `src/game/hostiles/hostileActorFactory.ts`
- `src/game/systems/enemies/brain.ts`
- `src/game/systems/enemies/behavior.ts`
- `src/game/systems/enemies/actions.ts`
- `src/game/systems/enemies/finalize.ts`
- `src/game/systems/enemies/enemyRuntime.ts`
- `src/game/systems/spawn/hostileSpawnDirector.ts`
- `src/game/systems/spawn/hostileSpawnExecution.ts`
- `src/game/systems/spawn/spawn.ts`

## Pipeline

1. **Floor Reset**: `world.ts` allocates `world.eBrain`, `world.hostileSpawnDirector`, and `world.hostileSpawnDebug`. Floor entry calls `resetHostileSpawnDirectorForFloor(world)`, clearing debug and reseeding RNG from `world.runSeed`, `currentFloorIntent?.nodeId`, `floorIndex`, `mapDepth`.
2. **Creation / Brain Init**: `EnemyDefinition` contains `spawn`, `stats`, `body`, `movement`, `ability`, optional presentation/rewards/death effects. Per-instance AI lives in `world.eBrain`, never content defs. Non-boss creation uses `spawnEnemyGrid(...)` / `spawnEnemy(...)`; `spawnEnemyGrid(...)` rejects `EnemyId.BOSS`, resolves definition, computes split stage/visual scale, applies delve scaling and heat health scaling for non-neutral enemies. `spawnHostileActorGrid(...)` appends aligned SoA rows plus initial `eBrain`, ailment state, `eSpawnTriggerId`, `eBossId`.
3. **Behavior Selection**: `game.ts` runs `enemyBehaviorSystem(world, dtSim)` before movement. It walks alive non-boss/non-loot enemies, normalizes `eBrain`, decrements cooldowns, skips scripted movers and PoE dormant enemies, leashes PoE enemies back to `"move"` and clears windup/leap transients. `aiType` drives states: `contact` moves; `caster` holds range -> windup -> acting -> cooldown; `suicide` winds up/acts inside hold band; `leaper` winds up/acts inside trigger range when cooldown clears.
4. **Movement Handoff**: this system selects brain state; `movementSystem(...)` consumes it. `"idle"`/`"dead"` do not move; `"move"` chases/holds; leapers in `"acting"` use `brain.leapDirX`, `leapDirY`, `leapTimeLeftSec`. Leap time is decremented by movement, not actions.
5. **Spawn Director**: later in-frame, `hostileSpawningEnabled(world)` gates auto-spawn off outside `RUN` + `FLOOR`, during floor-end countdown/death FX, on `VENDOR`/`HEAL`, during active PoE objectives, or while a boss is alive. `updateHostileSpawnDirector(...)` resolves settings, samples `t0 -> t120 -> overtime` power/sec and live-threat-cap curves, applies floor-depth heat scaling, accumulates/caps budget, computes live threat from alive hostile IDs, optionally enters burst mode, builds valid pools from enemy `spawn.*` excluding bosses/neutrals, samples role first then enemy, and purchases clamped requests by budget, live-threat room, `maxAlive`, role caps, unlock time/depth, and group-size bounds. It writes `world.hostileSpawnDebug` every update, including no-spawn.
6. **Spawn Execution**: `executeHostileSpawnRequests(...)` runs after neutral/objective sidecars and before player combat/actions. Requests expand to `spawnOneEnemyOfType(...)`, which requires `runState === "FLOOR"`, rejects vendor/heal floors, samples up to 20 ring points around player, validates walkability and same-floor/stairs/ramp compatibility, then calls `spawnEnemyGrid(...)`. Success/failure counters update debug snapshot.
7. **Actions**: after player combat, `enemyActionSystem(world, dtSim)` executes non-boss enemies already in `"acting"`. Projectile abilities aim enemy-to-player and `spawnProjectile(...)`, emit SFX, clear transients, set cooldown. Explode checks overlap, applies armor-mediated player damage, emits `PLAYER_HIT`/VFX/SFX, self-destructs via `finalizeEnemyDeath(..., { awardMomentum: false })`. Leap captures normalized direction once, applies impact once while active, and when movement drains timer, clears transients and cooldowns.
8. **Death Cleanup**: hostile deaths rely on `finalizeEnemyDeath(...)`: mark `eAlive` false, set brain `"dead"`, clear transients, record kills/challenge progress, optionally award momentum, record poisoned-on-death, run death effects (radial projectiles/splits), emit `ENEMY_KILLED`. Boss defeat also flows through this helper, but boss ownership is in `docs/canonical/boss_encounter_system.md`.

## Invariants

- Static hostile metadata is `EnemyDefinition`; runtime behavior state is `world.eBrain[enemyIndex]`.
- Default brain state is `"idle"` only for scripted-movement archetypes; otherwise `"move"`.
- Brain transitions must use `setEnemyBehaviorState(...)`; direct writes miss `stateTimeSec` reset.
- Windup/leap transients clear via `clearEnemyTransientState(...)` on cancel, completion, or death.
- Bosses are outside the standard spawn path; `spawnEnemyGrid(...)` throws for `EnemyId.BOSS`.
- Neutral monsters do not affect hostile spawn pacing or active-enemy summaries.
- Auto-spawn pacing is floor-scoped and reseeded/reset per floor.
- Director live threat uses authored `enemy.spawn.power`, not HP, position, or damage dealt.
- Director pacing is non-adaptive: elapsed floor time, depth heat, settings, and alive counts only.
- Director selection is role-first, then enemy via normal `weight` or `burstWeight`.
- Requests respect unlocks, group bounds, role caps, `maxAlive`, budget, and live-threat room.
- Director outputs abstract `HostileSpawnRequest[]`; placement/concrete creation are separate.
- Contact damage belongs to collision/contact simulation, not `enemyActionSystem(...)`.
- Hostile self-destruct/scripted deaths must route through `finalizeEnemyDeath(...)`.

## Constraints

- Behavior selection, movement consumption, spawn planning, spawn execution, and actions stay phase-separated; collapsing them changes frame semantics.
- The `game.ts` order among `enemyBehaviorSystem(...)`, `movementSystem(...)`, `updateHostileSpawnDirector(...)`, `executeHostileSpawnRequests(...)`, and `enemyActionSystem(...)` is architectural.
- Non-boss hostile creation must use `spawnEnemyGrid(...)` / `spawnHostileActorGrid(...)` for brain init, scaling, ailments, and SoA alignment.
- New hostile types extend shared `EnemyDefinition` metadata plus shared behavior/action systems, not bespoke ownership paths.
- Spawn pacing is driven by enemy `aiType`, `ability`, `spawn.*`, and director config, not ad hoc game-loop logic.
- Director remains pacing logic only: no placement, authored waves, boss scheduling, or player-performance adaptive difficulty.
- `EnemyBrainState` transient fields are shared contract state across behavior, movement, actions, and finalization.

## Dependencies

### Incoming

- World/enemy SoA/floor state from `src/engine/world/world.ts`
- Enemy content/lookup from `src/game/content/enemies.ts`, `registry.ts`, `neutralMonsters.ts`
- World/aim helpers from `src/game/coords/worldViews.ts`, `src/game/combat/aimPoints.ts`
- PoE dormancy/leash and power-budget hooks from `src/game/objectives/poeMapObjectiveSystem.ts`
- Movement, player armor, momentum helpers from sim systems
- Hostile spawn settings from `src/settings/settingsStore.ts`

### Outgoing

- `world.eBrain` to movement and hostile readers
- New enemy SoA rows for simulation, rendering, progression
- `world.hostileSpawnDebug` for debug rendering
- `world.events`: `PLAYER_HIT`, `SFX`, `VFX`, `ENEMY_KILLED`
- `ENEMY_KILLED.spawnTriggerId` for trigger/reward systems

## Extension

- AI family: `EnemyAiType`, behavior switch, movement/action consumers for new transients
- Ability kind: `EnemyAbilityConfig`, windup/transition logic, `actions.ts`
- Spawn role/pacing: `EnemySpawnRole`, role caps, role curves, debug/UI readers
- Placement policy: `spawnOneEnemyOfType(...)` or request executor, not director bypass
- Death effects/split scaling: `src/game/hostiles/hostileTypes.ts`, `finalize.ts`, `enemyRuntime.ts`

## Failure Modes

- Direct `world.e*` pushes skip brain, ailments, scaling.
- Bosses/neutrals in director inputs corrupt threat/caps.
- Direct `brain.state` writes break `stateTimeSec` and first-frame action logic.
- Stale leap/windup transients are reused by movement/actions.
- Contact damage in `enemyActionSystem(...)` duplicates collision timing.
- Spawning inside director mixes planning/execution and bypasses placement failures.
- Sampling whole pool instead of role-first changes pacing.
- Objective-specific or player-performance logic in director changes architecture.
- Treating `world.hostileSpawnDebug` as control state is wrong.
- Bypassing `finalizeEnemyDeath(...)` skips shared death effects/events.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
