# Core Simulation / Combat Runtime

## Purpose

Own the `world.state === "RUN"` gameplay execution path: input, time scaling, movement, weapon output, projectiles, collisions, DOT ticks, zones, momentum, pickups, and sim-side events that mutate live run state.

## Scope

- Live update-loop slice in `src/game/game.ts` that computes `dtSim`, gates run-state execution, and invokes the simulation sequence
- Input: `src/game/systems/sim/input.ts`
- Movement: `src/game/systems/sim/movement.ts`
- Combat/beam/collision geometry: `combat.ts`, `beamCombat.ts`, `beamShared.ts`, `collision3D.ts`
- Projectile spawn/runtime/lifecycle: `src/game/factories/projectileFactory.ts`, `projectiles.ts`, `projectileLifecycle.ts`
- Immediate hit/contact damage/finalization: `collisions.ts`, `hitDetection.ts`, `playerArmor.ts`, `src/game/systems/enemies/finalize.ts`
- Zones/delayed explosions/DOT/fission/momentum/pickups: `zoneFactory.ts`, `zones.ts`, `delayedExplosions.ts`, `src/game/combat/dot/dotTickSystem.ts`, `momentum.ts`, `fission.ts`, `src/game/systems/progression/pickups.ts`, `pickupHandlers.ts`
- Event emission/clearing: `src/engine/world/world.ts`, `src/game/events.ts`

## Non-scope

- Enemy brain/action and hostile spawn planning: `docs/canonical/hostile_ai_spawn_runtime.md`
- Boss orchestration/phase state beyond executing spawned projectiles/zones/hazards: `docs/canonical/boss_encounter_system.md`
- Objective/reward/outcome transitions and drop/gold/xp grant: `docs/canonical/progression_objectives_rewards.md`
- Combat stat authoring, modifiers, ailment rules: `docs/canonical/combat_mods_stat_resolution_loadout_effects.md`
- Audio/VFX/floating-text/UI consumption of sim events: `docs/canonical/ui_shell_menus_runtime_panels.md`

## Entrypoints

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

## Pipeline

1. **Frame Preamble**: `game.ts:update()` clamps `dtReal`, computes `world.timeState.timeScale`, derives `dtSim = dtReal * timeScale`, applies death slowdown, polls input, and zeros effective movement/interact input during death/game-over.
2. **Run Gate / Baseline**: heavy sim runs only in `RUN`. Before subsystem execution it updates `world.time`, `world.phaseTime`, `world.timeSec`, calls `recomputeDerivedStats(world)`, and ticks momentum decay. `MAP`/`REWARD` skip this slice after pause-specific work.
3. **Movement**: `movementSystem(...)` turns composed input into player velocity through `walkInfo(...)`-validated anchors and executes enemy locomotion from already-produced brain/behavior state: chase/flee, boss/objective locks, knockback, stair/ramp validation. World-space positions are derived then resynced to anchor-backed SoA arrays.
4. **Player Combat**: `combatSystem(...)` resolves current weapon/loadout, derived multipliers, and aim. Projectile mode calls `spawnProjectile(...)` with burst/spread/pierce/crit/ailment/target-lock payloads. Beam mode writes clamped beam state via `resolveClampedBeamGeometry(...)`; beam damage is fixed-tick.
5. **Projectiles**: `projectilesSystem(...)` owns TTL, movement, homing/arrival, bounce/wall interaction, range, orbital behavior, anchor/Z sync, and `despawnProjectile(...)` hit VFX. Missile arrival explosions and spark retargeting happen before collision resolution.
6. **Immediate Hits / Contact**: `collisionsSystem(...)` builds/queries enemy spatial hash and resolves projectile-enemy, projectile-player, and player-enemy contact hits with crit packets, ailment application, armor, bounce/pierce, explosion zones, DPS samples, and height-aware validation. Lethal outcomes call `finalizeEnemyDeath(...)`.
7. **Secondary Sidecars**: `fissionSystem(...)` handles projectile-projectile fission. `zonesSystem(...)` handles zone TTL, follow-player anchors, fire VFX, delayed explosions. `dotTickSystem(...)` accumulates `world.dotTickAcc` and fixed-ticks `tickAilmentsOnce(...)`, `tickZonesOnce(...)`, and `tickBeamContactsOnce(...)`.
8. **Momentum / Events**: immediate hits update momentum; `processMomentumEventQueue(...)` later consumes the separate `world.eventQueue`. Public events use `emitEvent(...)` into `world.events`: `ENEMY_HIT`, `ENEMY_KILLED`, `PLAYER_HIT`, `SFX`, `VFX`.
9. **Pickups / End of Frame**: `pickupsSystem(...)` moves vacuum/magnet pickups and syncs anchors. Chest side effects use `handleChestPickup(...)`, setting `world.chestOpenRequested` and pickup SFX. `processCombatTextFromEvents(...)` consumes hit events late; `clearEvents(world)` runs only after all frame consumers.

## Invariants

- `dtSim` is the authoritative simulation time input.
- Input edge flags clear only at end-of-frame through `clearInputEdges(...)`.
- Player, enemy, projectile, zone, and pickup positions remain anchor-backed; movement must resync anchors after world-space motion.
- Movement enforces same-floor movement except stair/ramp transitions within step limit.
- `combatSystem(...)` creates projectiles or beam state; it does not directly damage enemies.
- Immediate HIT damage is in `collisionsSystem(...)`; fixed-interval DOT damage is in `dotTickSystem(...)`.
- Standard hostile contact damage is collision-driven; `enemyActionSystem(...)` owns authored non-contact abilities after hostile state selection.
- Hit detection is height-aware, not XY-only.
- Projectile death routes through `despawnProjectile(...)`.
- Kill finalization routes through `finalizeEnemyDeath(...)`.
- `world.events` is frame-wide and clears only after downstream consumers; `world.eventQueue` is a separate momentum queue cleared by `processMomentumEventQueue(...)`.
- `pickupsSystem(...)` moves pickups but does not grant gold/xp or perform physical collection.

## Constraints

- Reordering movement, combat output, projectile updates, collisions, DOT ticks, or late event consumers is an architectural change.
- DOT effects must not drift into per-frame collision damage.
- Cross-system gameplay side effects must use `world.events` or dedicated world fields, not direct calls into audio/UI/reward code.
- Parallel unsynced world-position truth is not allowed.
- Shared kill handling stays centralized so death effects, kill events, momentum, and boss defeat stay coherent.

## Dependencies

### Incoming

- World schema and anchor-backed SoA from `src/engine/world/world.ts`
- Map walkability/support/solid-face queries from `src/game/map/compile/kenneyMap.ts`
- Enemy brain/action state and boss dormancy/locks
- Combat stat, crit, ailment, DOT, damage metadata helpers from `combat_mods/` and `combat/`
- User/debug settings for speed, god mode, damage/fire-rate multipliers, pickup magnet behavior

### Outgoing

- `world.events` for combat text, audio, VFX, drops/rewards/progression
- Updated spatial/runtime state for rendering, boss/progression/objectives, death/outcome handling
- `world.chestOpenRequested` for progression reward-run-event producers

## Extension

- Weapon fire modes: `combatSystem(...)` plus fixed-tick/projectile paths as needed
- Projectile behavior: `spawnProjectile(...)`, `projectilesSystem(...)`, `collisionsSystem(...)`
- Hazards/area damage: `spawnZone(...)`, `zonesSystem(...)`, `tickZonesOnce(...)`
- Momentum/armor side effects: `momentum.ts`, `playerArmor.ts`
- Pickup motion/interactions: `pickups.ts`, `pickupHandlers.ts`

## Failure Modes

- DOT-style damage in `collisionsSystem(...)` becomes frame-rate dependent.
- Manual `eAlive` kill changes skip death effects and `ENEMY_KILLED`.
- Manual projectile despawn skips `despawnProjectile(...)` VFX.
- World-space movement without anchor sync causes render/sim drift.
- Missing Z overlap creates cross-floor/cross-height hits.
- Treating `pickupsSystem(...)` as gold/xp collection authority is wrong.
- Early `world.events` clearing drops audio, combat text, and progression consumers.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
