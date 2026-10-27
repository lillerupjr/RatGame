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
- Poison trail zones: `src/game/systems/sim/poisonTrail.ts` — periodic trail zone spawning and poison-stack application
- Laser executor: `src/game/systems/sim/laserExecutor.ts` — periodic low-life enemy execution scan
- Next-shot empower: `src/game/systems/sim/empowerSystem.ts` — timed and kill-triggered next-shot damage empowerment
- Crit move speed buff: `src/game/systems/sim/critMoveSpeedBuff.ts` — temporary movement speed buff on player crit
- Living bomb: `src/game/systems/sim/livingBomb.ts` — periodic enemy mark, speed buff, and death explosion
- Event emission/clearing: `src/engine/world/world.ts`, `src/game/events.ts`

## Non-scope

- Enemy brain/action and hostile spawn planning: `docs/canonical/hostile_ai_spawn_runtime.md`
- Boss orchestration/phase state beyond executing spawned projectiles/zones/hazards: `docs/canonical/boss_encounter_system.md`
- Objective/reward/outcome transitions and drop/gold grant: `docs/canonical/progression_objectives_rewards.md`
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
- `src/game/systems/sim/poisonTrail.ts`
- `src/game/systems/sim/laserExecutor.ts`
- `src/game/systems/sim/empowerSystem.ts`
- `src/game/systems/sim/critMoveSpeedBuff.ts`
- `src/engine/world/world.ts`
- `src/game/events.ts`

## Pipeline

1. **Frame Preamble**: `game.ts:update()` clamps `dtReal`, computes `world.timeState.timeScale`, derives `dtSim = dtReal * timeScale`, applies death slowdown, polls input, and zeros effective movement/interact input during death/game-over.
2. **Run Gate / Baseline**: heavy sim runs only in `RUN`. Before subsystem execution it updates `world.time`, `world.phaseTime`, `world.timeSec`, calls `recomputeDerivedStats(world)`, and ticks momentum decay. `MAP`/`REWARD` skip this slice after pause-specific work.
3. **Movement**: `movementSystem(...)` turns composed input into player velocity through `walkInfo(...)`-validated anchors and executes enemy locomotion from already-produced brain/behavior state: chase/flee, boss/objective locks, knockback, stair/ramp validation. World-space positions are derived then resynced to anchor-backed SoA arrays.
4. **Player Combat**: `combatSystem(...)` resolves current weapon/loadout, derived multipliers, and aim. Projectile mode calls `spawnProjectile(...)` with burst/spread/pierce/crit/ailment/target-lock payloads. Beam mode writes clamped beam state via `resolveClampedBeamGeometry(...)`; beam damage is fixed-tick.
5. **Projectiles**: `projectilesSystem(...)` owns TTL, movement, homing/arrival, bounce/wall interaction, range, orbital behavior, anchor/Z sync, and `despawnProjectile(...)` hit VFX. Missile arrival explosions and spark retargeting happen before collision resolution.
6. **Immediate Hits / Contact**: `collisionsSystem(...)` builds/queries enemy spatial hash and resolves projectile-enemy, projectile-player, and player-enemy contact hits with crit packets, ailment application, armor, bounce/pierce, explosion zones, DPS samples, and height-aware validation. Lethal outcomes call `finalizeEnemyDeath(...)`.
7. **Combat Rule Sidecars**: `tickPoisonTrail(...)` spawns `ZONE_KIND.POISON` zones behind the player at a fixed drop interval. `tickLaserExecutor(...)` periodically scans for low-life enemies within range and kills them. `tickNextShotEmpower(...)` manages timed and kill-triggered next-shot damage empowerment. `tickCritMoveSpeedBuff(...)` grants temporary movement speed on player crit. `tickLivingBomb(...)` periodically marks the nearest enemy with Living Bomb; marked enemies gain speed and explode on death for fire damage. All run after collisions and before `zonesSystem(...)`.
8. **Secondary Sidecars**: `fissionSystem(...)` handles projectile-projectile fission. `zonesSystem(...)` handles zone TTL, follow-player anchors, fire VFX, delayed explosions. `dotTickSystem(...)` accumulates `world.dotTickAcc` and fixed-ticks `tickAilmentsOnce(...)`, `tickZonesOnce(...)`, `tickPoisonZones(...)`, and `tickBeamContactsOnce(...)`.
9. **Momentum / Events**: immediate hits update momentum; `processMomentumEventQueue(...)` later consumes the separate `world.eventQueue`. Public events use `emitEvent(...)` into `world.events`: `ENEMY_HIT`, `ENEMY_KILLED`, `PLAYER_HIT`, `SFX`, `VFX`.
10. **Pickups / End of Frame**: `pickupsSystem(...)` moves vacuum/magnet pickups and syncs anchors. Chest side effects use `handleChestPickup(...)`, setting `world.chestOpenRequested` and pickup SFX. `processCombatTextFromEvents(...)` consumes hit events late; `clearEvents(world)` runs only after all frame consumers.

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
- `pickupsSystem(...)` moves pickups but does not grant gold or perform physical collection.

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

## Combat Rule Consumers

Combat rules from ring progression are consumed by these runtime systems:

| Rule | Consumer | Behavior |
|---|---|---|
| `BURNING_ENEMIES_MOVE_SPEED_REDUCED` | `movement.ts` | Reduces chase speed of enemies with active ignite stacks. |
| `POISONED_ENEMIES_DAMAGE_REDUCED` | `collisions.ts` | Reduces contact damage from enemies with active poison stacks. |
| `POISONED_ENEMIES_EXPLODE_ON_DEATH` | `finalize.ts` | Triggers AoE chaos explosion on death of poisoned enemies, dealing a fraction of their max life. |
| `POISON_TRAIL` | `poisonTrail.ts` | Spawns `ZONE_KIND.POISON` zones behind player; zones apply poison stacks to enemies via `tickPoisonZones`. |
| `LASER_EXECUTOR` | `laserExecutor.ts` | Periodic scan-and-kill of enemies below HP threshold within range of the player. |
| `PHYSICAL_HIT_STUN_CHANCE` | `collisions.ts` | Chance to stun enemy on physical projectile hit; stun halts AI behavior and movement. |
| `TIMED_NEXT_SHOT_EMPOWER` | `empowerSystem.ts` → `combat.ts` | Periodic charge that empowers next player shot with increased physical damage. |
| `KILL_EMPOWER_NEXT_SHOT` | `empowerSystem.ts` → `combat.ts` | Kill event empowers next player shot with increased all-type damage. |
| `CRIT_MOVE_SPEED_BUFF` | `critMoveSpeedBuff.ts` → `derivedStats.ts` | Crit event grants temporary movement speed increase as a post-pipeline multiplier. |
| `LIVING_BOMB` | `livingBomb.ts` → `movement.ts`, `finalize.ts` | Periodically marks nearest enemy; marked enemy gains speed increase (`movement.ts`), explodes on death for fire AoE (`finalize.ts`). |

Enemy stun state (`stunLeftSec`) lives in `EnemyBrainState` (`brain.ts`). Stunned enemies skip all behavior transitions in `behavior.ts` and movement in `movement.ts`. Stun duration is consumed per-frame and does not stack (uses max of current and new duration).

Poison trail zones use `ZONE_KIND.POISON` (value 6) and do not deal direct zone damage. Instead, `tickPoisonZones()` pushes poison ailment stacks onto enemies in range, and the existing ailment DoT system handles the actual damage over time.

## Failure Modes

- DOT-style damage in `collisionsSystem(...)` becomes frame-rate dependent.
- Manual `eAlive` kill changes skip death effects and `ENEMY_KILLED`.
- Manual projectile despawn skips `despawnProjectile(...)` VFX.
- World-space movement without anchor sync causes render/sim drift.
- Missing Z overlap creates cross-floor/cross-height hits.
- Treating `pickupsSystem(...)` as gold collection authority is wrong.
- Early `world.events` clearing drops audio, combat text, and progression consumers.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
