# Hostile AI / Spawn Runtime

## Purpose

- Own the non-boss hostile runtime that decides what standard enemies do, when new hostiles may enter the floor, and how hostile ability execution mutates live world state.
- Convert enemy content definitions, floor pacing state, and per-enemy brain state into authoritative hostile behavior transitions, spawn requests, live enemy slots, and hostile action side effects.

## Scope

- Per-enemy hostile brain storage in `world.eBrain` and the hostile pacing/debug runtime fields in:
  - `src/engine/world/world.ts`
- Floor-entry hostile pacing reset and the top-level hostile update order in:
  - `src/game/game.ts`
- Enemy AI state creation, normalization, transition helpers, and transient cleanup in:
  - `src/game/systems/enemies/brain.ts`
- Non-boss hostile behavior-state selection in:
  - `src/game/systems/enemies/behavior.ts`
- Non-boss hostile action execution for projectile, explode, and leap abilities in:
  - `src/game/systems/enemies/actions.ts`
- Shared hostile runtime scaling inputs for split stage and visual scale in:
  - `src/game/systems/enemies/enemyRuntime.ts`
- Non-boss enemy factory creation and hostile actor slot initialization in:
  - `src/game/factories/enemyFactory.ts`
  - `src/game/hostiles/hostileActorFactory.ts`
- Hostile pacing config resolution, heat scaling, budget accumulation, request generation, and debug snapshot creation in:
  - `src/game/systems/spawn/hostileSpawnDirector.ts`
- Spawn-request execution and generic hostile placement sampling in:
  - `src/game/systems/spawn/hostileSpawnExecution.ts`
  - `src/game/systems/spawn/spawn.ts`

## Non-scope

- Player/enemy locomotion execution, collision resolution, projectile runtime updates, and contact-hit damage in the core simulation system
- Boss encounter spawning, boss phase logic, and boss-specific abilities
- Neutral monster runtime such as loot goblins, except where this system explicitly excludes them from hostile pacing
- Objective-authored population planners and scripted spawn flows such as PoE pack generation or rare-zone spawns, except where this system exposes hooks they reuse
- Reward/drop handling, gold/xp grants, and trigger/outcome processing after kills
- Rendering, audio, and debug-UI consumption of hostile events or hostile spawn debug snapshots

## Key Entrypoints

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

## Data Flow / Pipeline

1. **Floor Setup and Hostile Runtime Reset**
   - `world.ts` allocates the hostile runtime fields:
     - `world.eBrain`
     - `world.hostileSpawnDirector`
     - `world.hostileSpawnDebug`
   - On floor entry, `game.ts` calls `resetHostileSpawnDirectorForFloor(world)`.
   - The reset path clears the debug snapshot and reseeds the director RNG from:
     - `world.runSeed`
     - `world.currentFloorIntent?.nodeId`
     - `world.floorIndex`
     - `world.mapDepth`

2. **Enemy Creation and Brain Initialization**
   - Static hostile content lives in `EnemyDefinition` entries from `content/enemies.ts`, which bundle:
     - `spawn`
     - `stats`
     - `body`
     - `movement`
     - `ability`
     - optional `presentation`, `rewards`, and `deathEffects`
   - Per-instance runtime AI state lives separately in `world.eBrain`; it is not stored back into enemy content definitions.
   - Non-boss hostile creation enters through `spawnEnemyGrid(...)` or `spawnEnemy(...)`.
   - `spawnEnemyGrid(...)`:
     - rejects `EnemyId.BOSS`
     - resolves the enemy definition from `registry.enemy(type)`
     - computes split-stage and visual-scale runtime values
     - applies delve scaling
     - applies hostile heat health scaling for non-neutral enemies through `resolveHostileSpawnHeatHealthMultiplier(...)`
   - `spawnHostileActorGrid(...)` appends the canonical hostile SoA rows:
     - position anchors
     - HP/base-life/damage/radius
     - split-stage and visual scale
     - ailment state
     - `eSpawnTriggerId` / `eBossId`
     - initial `eBrain` from `brainFactory`

3. **Behavior Selection Phase**
   - During active gameplay frames, `game.ts` runs `enemyBehaviorSystem(world, dtSim)` before enemy movement.
   - `enemyBehaviorSystem(...)` walks alive enemies, skips bosses, skips loot goblins, normalizes/creates `eBrain`, and decrements brain cooldown state.
   - Scripted movers and PoE-dormant enemies do not advance hostile behavior selection.
   - PoE leashing forces a hostile back to `"move"` and clears transient windup/leap state.
   - AI-type branching is content-driven from `EnemyDefinition.aiType`:
     - `contact`: stay in `"move"`
     - `caster`: hold range, enter `"windup"`, then `"acting"`, then `"cooldown"`
     - `suicide`: move until inside the authored hold band, then `"windup"` and `"acting"`
     - `leaper`: move until inside the leap trigger range and cooldown is clear, then `"windup"` and `"acting"`

4. **Movement Handoff Contract**
   - This system does not execute locomotion, but it owns the brain contract that `movementSystem(...)` consumes.
   - `movementSystem(...)` uses hostile brain state to decide whether an enemy may move:
     - `"idle"` and `"dead"` do not move
     - `"move"` follows the usual chase/hold-band logic
     - leapers in `"acting"` use `brain.leapDirX`, `brain.leapDirY`, and `brain.leapTimeLeftSec`
   - Leap travel time is decremented in movement, not in `enemyActionSystem(...)`.

5. **Spawn Pacing and Request Generation**
   - Later in the same frame, `game.ts` computes:
     - `spawningEnabled` through `hostileSpawningEnabled(world)`
     - `activeEnemies` through `collectAliveHostileEnemiesForSpawnDirector(world)`
   - `hostileSpawningEnabled(...)` disables hostile auto-spawns when:
     - the game is not in `RUN` + `FLOOR`
     - floor-end countdown is active
     - death FX is active
     - the floor archetype is `VENDOR` or `HEAL`
     - a PoE objective is active
     - a boss is alive
   - `updateHostileSpawnDirector(...)` then:
     - resolves tuning config from current system settings
     - samples elapsed-time power-per-second and live-threat-cap anchor curves:
       - `0..120s`: linear interpolation from `t0` to `t120`
       - `120s+`: linear overtime continuation from the `t120` anchor
     - applies floor-heat scaling from depth
     - accumulates director budget
     - computes live threat from currently alive hostile enemy IDs
     - caps stored budget by `liveThreatCap * stockpileMultiplier`
     - optionally enters burst mode
     - builds a valid hostile pool from canonical enemy `spawn.*` metadata, excluding bosses and neutral monsters
     - groups that valid pool by role, samples a role through `roleWeightCurves`, then samples an enemy inside that role through normal `weight` or burst `burstWeight`
     - rolls group size and clamps it against:
       - budget
       - remaining live-threat room
       - per-enemy remaining `maxAlive`
       - per-role remaining cap
     - purchases spawn requests subject to:
       - enemy unlock time and unlock depth
       - per-enemy `maxAlive`
       - per-role caps
       - available budget
       - remaining live-threat room
       - authored group-size bounds
   - The director writes a derived `world.hostileSpawnDebug` snapshot every update, including the no-spawn path.

6. **Spawn Execution and Placement**
   - `executeHostileSpawnRequests(...)` consumes the director output after the neutral/objective sidecars and before player combat/action resolution.
   - Each request expands into `count` calls to `spawnOneEnemyOfType(...)`.
   - `spawnOneEnemyOfType(...)`:
     - refuses to spawn outside `runState === "FLOOR"`
     - refuses vendor/heal floors
     - samples up to 20 random points in a ring around the player
     - validates walkability and same-floor/stairs/ramp compatibility
     - delegates final slot creation to `spawnEnemyGrid(...)`
   - Successful and failed placement attempts update the live debug snapshot counters.

7. **Hostile Action Execution**
   - After player combat output, `game.ts` runs `enemyActionSystem(world, dtSim)`.
   - `enemyActionSystem(...)` only executes non-boss enemies whose brain state is already `"acting"`.
   - Projectile abilities:
     - aim from enemy aim point toward the player aim point
     - create a projectile through `spawnProjectile(...)`
     - emit hostile-fire SFX
     - clear transients, set cooldown, and transition to `"cooldown"`
   - Explode abilities:
     - check player overlap inside the authored impact radius
     - apply incoming player damage through armor
     - emit `PLAYER_HIT`, VFX, and SFX events
     - self-destruct through `finalizeEnemyDeath(...)` with `awardMomentum: false`
   - Leap abilities:
     - on the first acting frame, capture a normalized leap direction toward the player and compute travel duration from current spacing
     - while the leap is active, apply the impact hit at most once
     - when movement has consumed the leap timer to zero, clear transients, set cooldown, and return to non-acting state

8. **Death-State Cleanup Boundary**
   - This system relies on `finalizeEnemyDeath(...)` for hostile death-state closure.
   - `finalizeEnemyDeath(...)`:
     - marks `eAlive` false
     - sets the hostile brain to `"dead"` and clears transient state
     - records kill count and challenge progress
     - optionally awards momentum
     - records poisoned-on-death state
     - runs authored death effects such as radial projectiles or split-into-children
     - emits `ENEMY_KILLED`
   - Boss-defeat semantics also flow through the same helper, but boss ownership lives in the boss system doc.

## Core Invariants

- `EnemyDefinition` is the authoritative static hostile metadata bundle for standard enemies; `world.eBrain` stores only per-instance runtime behavior state.
- `world.eBrain[enemyIndex]` is the authoritative hostile AI state slot for the aligned enemy SoA row.
- Default hostile brain state is `"idle"` only for scripted-movement archetypes; all other hostile archetypes default to `"move"`.
- Brain transitions must use `setEnemyBehaviorState(...)` so `stateTimeSec` resets correctly.
- Windup/leap transient fields must be cleared with `clearEnemyTransientState(...)` when an action is canceled, completed, or the enemy dies.
- Boss entities are outside this system's standard spawn path; `spawnEnemyGrid(...)` throws for `EnemyId.BOSS`.
- Neutral monsters do not contribute to hostile spawn pacing and are excluded from the director's active-enemy summary.
- Hostile auto-spawn pacing is floor-scoped; `resetHostileSpawnDirectorForFloor(...)` reseeds director state per floor and clears stale debug state.
- Director live threat is derived from authored `enemy.spawn.power`, not from HP, positions, or damage dealt.
- Director pacing is non-adaptive: it depends on elapsed floor time, floor-depth heat, current tuning settings, and alive-hostile counts, not on player performance metrics such as damage taken or current HP.
- Director selection is role-first:
  - sample role via `roleWeightCurves`
  - then sample enemy inside that role via `weight` / `burstWeight`
- Director requests must respect enemy unlock gates, group-size bounds, role caps, per-enemy `maxAlive`, available budget, and live-threat room.
- The director outputs abstract `HostileSpawnRequest[]`; placement validity and concrete actor creation remain separate execution steps.
- `enemyBehaviorSystem(...)` selects states; `movementSystem(...)` consumes those states; `enemyActionSystem(...)` only executes enemies already in `"acting"`.
- Contact damage is not authored through `enemyActionSystem(...)`; that path belongs to collision/contact simulation.
- Hostile self-destruct or scripted hostile deaths must route through `finalizeEnemyDeath(...)` so brain state, death effects, and `ENEMY_KILLED` emission remain consistent.

## Design Constraints

- The hostile runtime remains phase-separated: behavior selection, movement consumption, spawn request generation, spawn execution, and hostile action execution are distinct steps in the frame. Collapsing them changes gameplay semantics.
- The update order in `game.ts` between `enemyBehaviorSystem(...)`, `movementSystem(...)`, `updateHostileSpawnDirector(...)`, `executeHostileSpawnRequests(...)`, and `enemyActionSystem(...)` is architectural and must not drift casually.
- Non-boss hostile creation must continue to flow through `spawnEnemyGrid(...)` and `spawnHostileActorGrid(...)` so brain initialization, scaling, ailment state, and SoA alignment stay correct.
- Static hostile data must remain centralized in enemy content definitions. New hostile types should extend shared `EnemyDefinition` metadata plus shared behavior/action systems rather than introducing bespoke per-enemy runtime ownership paths.
- Spawn pacing must continue to be driven by canonical enemy content metadata (`aiType`, `ability`, `spawn.*`) plus resolved director config, not by ad hoc per-enemy logic in the game loop.
- The hostile spawn director must remain procedural pacing logic only:
  - no placement logic
  - no authored wave tables
  - no boss scheduling
  - no adaptive difficulty layer keyed to player performance
- `EnemyBrainState` transient fields (`cooldownLeftSec`, `windupLeftSec`, `leapDir*`, `leapTimeLeftSec`, `leapHitDone`) are shared contract state across behavior, movement, actions, and death finalization. Changing them requires updating every consumer.

## Dependencies (In/Out)

### Incoming

- World state, enemy SoA arrays, and floor/run-state context from `src/engine/world/world.ts`
- Enemy content definitions and lookup from:
  - `src/game/content/enemies.ts`
  - `src/game/content/registry.ts`
  - `src/game/content/neutralMonsters.ts`
- Player/enemy world-space and aim-point helpers from:
  - `src/game/coords/worldViews.ts`
  - `src/game/combat/aimPoints.ts`
- PoE objective dormancy/leash hooks and reused power-budget estimation from:
  - `src/game/objectives/poeMapObjectiveSystem.ts`
- Movement execution, collision damage, momentum, and player armor helpers from:
  - `src/game/systems/sim/movement.ts`
  - `src/game/systems/sim/playerArmor.ts`
  - `src/game/systems/sim/momentum.ts`
- System settings used to resolve hostile spawn pacing config from:
  - `src/settings/settingsStore.ts`

### Outgoing

- `world.eBrain` state consumed by movement and any other per-enemy runtime readers
- New hostile enemy rows appended into the world SoA model for later simulation, rendering, and progression systems
- `world.hostileSpawnDebug` consumed by debug rendering
- `world.events` emissions such as `PLAYER_HIT`, `SFX`, `VFX`, and `ENEMY_KILLED` consumed by audio, VFX, combat text, and progression systems
- `ENEMY_KILLED.spawnTriggerId` propagation used by trigger/reward systems

## Extension Points

- Add a new hostile AI family by extending:
  - `EnemyAiType` in `src/game/content/enemies.ts`
  - the state-selection switch in `src/game/systems/enemies/behavior.ts`
  - any movement/action consumers that depend on new transient fields
- Add a new hostile ability kind by extending:
  - `EnemyAbilityConfig`
  - windup/transition logic in `behavior.ts`
  - execution logic in `actions.ts`
- Add a new spawn role or pacing family by extending:
  - `EnemySpawnRole`
  - role caps and role-weight curves in `hostileSpawnDirector.ts`
  - any debug/UI readers that assume the existing role set
- Change hostile placement policy by extending `spawnOneEnemyOfType(...)` or replacing the request executor, not by bypassing the director contract
- Add new hostile death effects or split-stage scaling behavior through:
  - `src/game/hostiles/hostileTypes.ts`
  - `src/game/systems/enemies/finalize.ts`
  - `src/game/systems/enemies/enemyRuntime.ts`

## Failure Modes / Common Mistakes

- Spawning enemies by pushing directly into `world.e*` arrays skips brain initialization, ailment setup, and hostile scaling.
- Calling `spawnEnemyGrid(...)` with `EnemyId.BOSS` throws and violates the boss-system boundary.
- Treating neutral monsters or bosses as normal hostile spawn-director inputs corrupts live-threat accounting and pacing caps.
- Writing `brain.state = ...` directly without `setEnemyBehaviorState(...)` leaves `stateTimeSec` inconsistent and breaks first-frame action logic such as leap setup.
- Forgetting to clear transient leap/windup fields when canceling an action leaves stale runtime state that movement/action consumers will reuse.
- Applying contact-hit damage in `enemyActionSystem(...)` duplicates the collision system and changes damage timing.
- Spawning enemies directly inside `updateHostileSpawnDirector(...)` mixes planning with execution and bypasses placement failure handling.
- Sampling enemies directly across the whole valid pool instead of role-first changes the pacing model and breaks the current role-weight contract.
- Adding objective-specific special cases or player-performance adaptation directly inside the hostile director changes the architecture from procedural pacing to scenario logic.
- Treating `world.hostileSpawnDebug` as control state is incorrect; it is a derived snapshot for inspection only.
- Bypassing `finalizeEnemyDeath(...)` for hostile self-destruction skips shared death effects and `ENEMY_KILLED` emission.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
