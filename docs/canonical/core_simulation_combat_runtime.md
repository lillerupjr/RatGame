# Core Simulation / Combat Runtime

## Purpose

- Own the frame-by-frame gameplay execution path that mutates live run state during `world.state === "RUN"`.
- Convert input, time scaling, movement intents, weapon fire, projectile state, collisions, DOT ticks, zone hazards, momentum, and sim-side events into authoritative runtime outcomes.

## Scope

- The live update-loop slice in `src/game/game.ts` that computes `dtSim`, gates run-state execution, and invokes the simulation sequence
- Input composition and edge handling in:
  - `src/game/systems/sim/input.ts`
- Player and enemy locomotion execution in:
  - `src/game/systems/sim/movement.ts`
- Player weapon fire, aim resolution, projectile spawn, and beam activation in:
  - `src/game/systems/sim/combat.ts`
  - `src/game/systems/sim/beamCombat.ts`
  - `src/game/systems/sim/beamShared.ts`
  - `src/game/systems/sim/collision3D.ts`
- Projectile runtime state, lifetime, target arrival, bounce, range, and despawn behavior in:
  - `src/game/factories/projectileFactory.ts`
  - `src/game/systems/sim/projectiles.ts`
  - `src/game/systems/sim/projectileLifecycle.ts`
- Immediate hit/contact damage resolution and combat event emission in:
  - `src/game/systems/sim/collisions.ts`
  - `src/game/systems/sim/hitDetection.ts`
  - `src/game/systems/sim/playerArmor.ts`
  - `src/game/systems/enemies/finalize.ts`
- Zone upkeep, delayed explosions, and fixed-tick hazard damage in:
  - `src/game/factories/zoneFactory.ts`
  - `src/game/systems/sim/zones.ts`
  - `src/game/systems/sim/delayedExplosions.ts`
- Fixed-tick DOT scheduling in:
  - `src/game/combat/dot/dotTickSystem.ts`
- Momentum gain/decay/break processing in:
  - `src/game/systems/sim/momentum.ts`
- Projectile-projectile fission behavior in:
  - `src/game/systems/sim/fission.ts`
- Pickup vacuum/magnet movement and chest-open side effects in:
  - `src/game/systems/progression/pickups.ts`
  - `src/game/systems/sim/pickupHandlers.ts`
- Simulation event emission and frame-end clearing in:
  - `src/engine/world/world.ts`
  - `src/game/events.ts`

## Non-scope

- Enemy brain-state selection, hostile spawn planning, and enemy action authoring
- Boss encounter orchestration and boss phase state, beyond this system executing the projectiles/zones/hazards those systems create
- Objective/trigger/reward scheduling and run outcome transitions
- Combat stat authoring, modifier definition, and ailment rule authoring in `combat_mods/`; this system consumes those rules
- Audio, VFX, floating-text rendering, and UI consumption of sim events
- Drop spawning, gold/xp grant, and physical pickup collection in `src/game/systems/progression/drops.ts`

## Key Entrypoints

- `src/game/game.ts`
- `src/game/systems/sim/input.ts`
- `src/game/systems/sim/movement.ts`
- `src/game/systems/sim/combat.ts`
- `src/game/systems/sim/beamCombat.ts`
- `src/game/systems/sim/beamShared.ts`
- `src/game/systems/sim/collision3D.ts`
- `src/game/factories/projectileFactory.ts`
- `src/game/systems/sim/projectiles.ts`
- `src/game/systems/sim/projectileLifecycle.ts`
- `src/game/systems/sim/collisions.ts`
- `src/game/systems/sim/hitDetection.ts`
- `src/game/systems/sim/playerArmor.ts`
- `src/game/systems/enemies/finalize.ts`
- `src/game/factories/zoneFactory.ts`
- `src/game/systems/sim/zones.ts`
- `src/game/systems/sim/delayedExplosions.ts`
- `src/game/combat/dot/dotTickSystem.ts`
- `src/game/systems/sim/momentum.ts`
- `src/game/systems/sim/fission.ts`
- `src/game/systems/progression/pickups.ts`
- `src/game/systems/sim/pickupHandlers.ts`
- `src/engine/world/world.ts`
- `src/game/events.ts`

## Data Flow / Pipeline

1. **Frame Preamble and Time Scaling**
   - `game.ts:update()` clamps `dtReal`, computes `world.timeState.timeScale`, and derives `dtSim = dtReal * timeScale`.
   - Death slowdown modifies the simulation time scale before the sim slice runs.
   - Input is always polled through `inputSystem(...)`, but death/game-over states zero the effective movement/interact inputs.

2. **Run-State Gating and Baseline Runtime State**
   - The heavy simulation path runs only while `world.state === "RUN"`.
   - Before subsystem execution, the runtime updates:
     - `world.time`
     - `world.phaseTime`
     - `world.timeSec`
     - derived combat/player stats via `recomputeDerivedStats(world)`
     - momentum decay via `tickMomentumDecay(...)`
   - `MAP` and `REWARD` states skip the core sim slice and return after pause-specific UI/runtime work.

3. **Locomotion Execution**
   - `movementSystem(...)` converts composed input into player world velocity and applies movement through `walkInfo(...)`-validated anchor updates.
   - The same system executes enemy locomotion from already-produced brain/behavior state:
     - flow-field chase/flee steering
     - boss and objective dormancy/movement locks
     - knockback decay
     - stair/ramp-aware movement validation
   - Player/enemy positions remain anchor-backed; world-space positions are derived, moved, then resynced back into SoA anchor arrays.

4. **Player Combat Output**
   - `combatSystem(...)` resolves the current weapon from character/start-loadout state, consumes derived stat multipliers, and picks a target/aim vector.
   - Projectile fire mode:
     - spawns one or more projectiles through `spawnProjectile(...)`
     - supports burst timing, spread, pierce, crit, ailments, and target-lock payloads
   - Beam fire mode:
     - resolves a clamped beam segment through `resolveClampedBeamGeometry(...)`
     - writes live beam state into world fields
     - defers beam damage to the fixed-tick DOT path

5. **Projectile Runtime**
   - `projectilesSystem(...)` owns projectile TTL, movement, target homing/arrival, bounce/wall interaction, range limiting, and orbital behavior.
   - It keeps projectile anchor/Z state in sync and routes projectile death through `despawnProjectile(...)`, which also spawns hit VFX.
   - Special projectile behaviors such as missile arrival explosions and spark retargeting happen here before collision resolution.

6. **Immediate Hit and Contact Resolution**
   - `collisionsSystem(...)` builds/queries the enemy spatial hash and resolves:
     - projectile -> enemy hits
     - projectile -> player hits
     - player <-> enemy contact hits
   - Hit resolution includes:
     - crit packet resolution
     - ailment application
     - armor absorption for player damage
     - projectile bounce/pierce consumption
     - explosion-zone spawning
     - DPS sample tracking
     - height-aware hit validation through `hitDetection.ts`
   - Lethal outcomes call `finalizeEnemyDeath(...)`, which centralizes kill counting, death effects, boss-defeat marking, and `ENEMY_KILLED` event emission.

7. **Secondary Combat Sidecars**
   - `fissionSystem(...)` checks projectile-projectile collisions for fission-enabled projectiles and spawns perpendicular children.
   - `zonesSystem(...)` performs per-frame zone upkeep:
     - TTL decay
     - follow-player anchor sync
     - fire-zone VFX maintenance
     - delayed-explosion queue ticking
   - `dotTickSystem(...)` accumulates `world.dotTickAcc` and advances fixed-interval damage ticks via:
     - `tickAilmentsOnce(...)`
     - `tickZonesOnce(...)`
     - `tickBeamContactsOnce(...)`

8. **Momentum and Sim-Side Event Processing**
   - Momentum gain/break/decay logic lives in `momentum.ts`.
   - Immediate hit systems update momentum state, and `processMomentumEventQueue(...)` consumes the separate `world.eventQueue` later in the frame.
   - Public gameplay events are emitted into `world.events` through `emitEvent(...)` and include:
     - `ENEMY_HIT`
     - `ENEMY_KILLED`
     - `PLAYER_HIT`
     - `SFX`
     - `VFX`

9. **Pickup Motion and End-of-Frame Event Lifetime**
   - `pickupsSystem(...)` handles pickup vacuum/magnet movement and keeps pickup anchors synced.
   - Chest-open side effects are expressed through `handleChestPickup(...)`, which sets `world.chestOpenRequested` and emits pickup SFX.
   - `processCombatTextFromEvents(...)` consumes hit events late in the frame, and `clearEvents(world)` runs only after all frame consumers finish.

## Core Invariants

- The core simulation slice only executes while `world.state === "RUN"`.
- `dtSim` is the authoritative time input for this system; it is derived from `dtReal * world.timeState.timeScale`.
- Input edge flags are cleared only at end-of-frame through `clearInputEdges(...)`.
- Runtime positions for player, enemies, projectiles, zones, and pickups remain anchor-backed. Movement code must resync anchors after world-space motion.
- `movementSystem(...)` enforces same-floor movement except through stair/ramp transitions whose Z delta stays within the configured step limit.
- `combatSystem(...)` creates projectiles or beam state; it does not directly apply enemy hit damage.
- Immediate HIT damage is resolved in `collisionsSystem(...)`; fixed-interval DOT damage is resolved through `dotTickSystem(...)`.
- Standard hostile contact damage remains collision-driven; hostile `enemyActionSystem(...)` owns only authored non-contact abilities such as projectiles, leaps, and self-destruct actions after the hostile runtime has already selected `"acting"`.
- Hit detection is height-aware and uses projectile/player/enemy Z state, not XY overlap alone.
- Projectile death should route through `despawnProjectile(...)` so projectile-hit VFX stay consistent.
- Kill finalization should route through `finalizeEnemyDeath(...)`, not through ad hoc `eAlive`/kill/event mutations in leaf systems.
- `world.events` is the frame-wide gameplay event stream and is cleared only after downstream consumers finish that frame.
- `world.eventQueue` is a separate internal queue currently used by momentum processing and is cleared by `processMomentumEventQueue(...)`.
- `pickupsSystem(...)` moves pickups but does not grant gold/xp or perform the physical pickup-collection loop.

## Design Constraints

- The simulation order in `game.ts` is authoritative. Reordering movement, combat output, projectile updates, collisions, DOT ticks, or late event consumers changes gameplay semantics and must be treated as an architectural change.
- Immediate-hit and fixed-tick damage paths must remain separate. DOT effects must not drift into the per-frame collision path.
- Live gameplay side effects that other systems consume must continue to flow through `world.events` or dedicated world fields, not through ad hoc direct calls into audio/UI/reward code.
- Runtime entities must keep anchor-backed SoA state as the authoritative spatial model. Parallel unsynced world-position truth is not allowed.
- Shared kill handling must remain centralized through `finalizeEnemyDeath(...)` so death effects, kill events, momentum, and boss-defeat logic stay coherent.

## Dependencies (In/Out)

### Incoming

- World schema and anchor-backed SoA storage from `src/engine/world/world.ts`
- Map walkability, support-surface, and solid-face queries from `src/game/map/compile/kenneyMap.ts`
- Enemy brain/action state and boss dormancy/locks from hostile/boss systems
- Combat stat resolution, ailment application/ticking, crit packet resolution, and damage metadata helpers from `combat_mods/` and `combat/`
- User/debug settings that affect game speed, god mode, damage multipliers, fire-rate multipliers, and pickup magnet behavior

### Outgoing

- `world.events` consumed later in-frame by:
  - combat text generation
  - audio
  - VFX
  - drop/reward/progression systems
- Updated world spatial/runtime state consumed by:
  - rendering
  - boss/progression/objective systems
  - outcome/death handling
- `world.chestOpenRequested` consumed by progression reward-run-event producers

## Extension Points

- Add new weapon fire modes by extending `combatSystem(...)` and, if needed, adding new fixed-tick or projectile-runtime paths
- Add new projectile behaviors through:
  - `spawnProjectile(...)`
  - `projectilesSystem(...)`
  - `collisionsSystem(...)`
- Add new hazard or area-damage behaviors through `spawnZone(...)`, `zonesSystem(...)`, and `tickZonesOnce(...)`
- Add new momentum or armor side effects through `momentum.ts` and `playerArmor.ts`
- Add new pickup motion/interaction side effects through `pickups.ts` and `pickupHandlers.ts`

## Failure Modes / Common Mistakes

- Applying DOT-style damage directly in `collisionsSystem(...)` makes damage output frame-rate dependent and bypasses the fixed-tick contract.
- Killing enemies by flipping `eAlive` manually instead of calling `finalizeEnemyDeath(...)` skips centralized death effects and `ENEMY_KILLED` emission.
- Despawning projectiles by writing `pAlive = false` directly skips `despawnProjectile(...)` hit-VFX behavior.
- Moving entities in world space without resyncing anchor arrays causes render/sim position drift.
- Forgetting Z overlap in hit logic creates cross-floor or cross-height hits that the live system is designed to reject.
- Treating `pickupsSystem(...)` as the gold/xp collection authority is incorrect; it only handles pickup motion.
- Clearing `world.events` early drops downstream consumers such as audio, combat text, and progression-side event processors.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
