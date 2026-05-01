# Boss Encounter System

## Purpose

Own registered boss encounters: actor spawn/registration, dormant activation, cast state, arena hazard sequencing, boss-specific player damage, and defeat cleanup. Expose state for objectives, HUD/rendering, spawn gating, and run completion.

## Scope

- Boss runtime fields in `src/engine/world/world.ts`: `bossRuntime`, `arenaTileEffects`, boss-tagged enemy rows via `eBossId`
- Floor-load hookup and top-level update call in `src/game/game.ts`
- Boss content/types/registry: `src/game/bosses/bossTypes.ts`, `bossDefinitions.ts`, `bossAbilities.ts`, `bossRegistry.ts`
- Registration, lookup, activation, defeat bookkeeping: `src/game/bosses/bossRuntime.ts`
- Actor spawn and map-anchor resolution: `src/game/bosses/spawnBossEncounter.ts`
- Per-frame ticking: `src/game/bosses/bossSystem.ts`
- Cast selection/phase/ability handlers: `src/game/bosses/bossAbilityRunner.ts`
- Arena construction/sequencing: `src/game/bosses/bossArena.ts`, `bossArenaPatterns.ts`, `bossArenaActions.ts`, `bossArenaTypes.ts`
- Persistent arena hazards/damage ticks: `src/game/bosses/arenaTileEffects.ts`

## Non-scope

- Act-boss floor/map selection in `src/game/bosses/actBossPlan.ts`
- Generic movement/collision/projectile/death systems except explicit boss-state reads: `docs/canonical/core_simulation_combat_runtime.md`
- Objective/reward/floor advancement: `docs/canonical/progression_objectives_rewards.md`
- Rendering/HUD/boss-bar drawing: `docs/canonical/presentation_rendering_pipeline.md` and `docs/canonical/ui_shell_menus_runtime_panels.md`
- Standard hostile brain/action/spawn pacing: `docs/canonical/hostile_ai_spawn_runtime.md`

## Entrypoints

- `src/engine/world/world.ts`
- `src/game/game.ts`
- `src/game/bosses/bossTypes.ts`
- `src/game/bosses/bossDefinitions.ts`
- `src/game/bosses/bossAbilities.ts`
- `src/game/bosses/bossRegistry.ts`
- `src/game/bosses/bossRuntime.ts`
- `src/game/bosses/spawnBossEncounter.ts`
- `src/game/bosses/bossSystem.ts`
- `src/game/bosses/bossAbilityRunner.ts`
- `src/game/bosses/bossArena.ts`
- `src/game/bosses/bossArenaPatterns.ts`
- `src/game/bosses/bossArenaActions.ts`
- `src/game/bosses/bossArenaTypes.ts`
- `src/game/bosses/arenaTileEffects.ts`

## Pipeline

1. **Reset / Floor Load**: `clearFloorEntities(...)` resets enemy arrays and calls `resetBossRuntime(world)`. `beginFloorLoad(...)` wires objectives first, then for `ACT_BOSS` with `bossId` calls `spawnActBossEncounterFromActiveMap(...)`. Live path spawns at most one boss per act-boss floor, though `bossRuntime.encounters` is an array.
2. **Spawn / Register**: `spawnActBossEncounterFromActiveMap(...)` requires `activeMap.semanticData.bossSpawn`. `spawnBossEncounter(...)` resolves the boss definition, converts target world position to grid, spawns through `spawnHostileActorGrid(...)`, stamps `EnemyId.BOSS`/`eBossId`, and scales HP/contact damage from `world.delveScaling`. `registerBossEncounter(...)` creates `BossEncounterState` with id, status, activation state, null `activeCast`, per-ability cooldown map, round-robin cursor, and optional objective binding.
3. **Activation**: `bossEncounterSystem(world, dt)` runs after relic-on-kill sidecars and before zones/DOT work. It updates `arenaTileEffects`, then active encounters. Dormant encounters activate when player tile distance is within `boss.engageDistanceTiles`; while dormant they do not move, collide by contact, or cast.
4. **Movement Contract**: bosses bypass `eBrain` and hostile behavior/action systems. `movementSystem(...)` moves boss actors from `BossDefinition` movement config plus runtime gates: dormant bosses do not move; `isBossMovementLockedByCast(...)` currently locks during `POISON_FLAMETHROWER` `ACTIVE`.
5. **Ability Selection / Cast Start**: active alive encounters not casting and clear of `globalCooldownLeftSec` call `selectAbilityForEncounter(...)`, which scans `abilityLoadout` from `nextAbilityCursor` and returns the first ability with clear individual cooldown. `beginBossCast(...)` creates `BossCastRuntimeState`, target data, beam/world-effect/burst/arena runtime, `activeCast`, and `requestedAnimation`; the system then sets `globalCooldownLeftSec = 0.15`.
6. **Cast Phase Machine**: casts advance `TELEGRAPH -> ACTIVE -> RESOLVE -> COOLDOWN -> cleanup` by authored durations; zero-duration phases skip immediately. `setCastPhase(...)` resets timers, updates animation, stamps per-ability cooldown on `ACTIVE`, and fires ability phase hooks. `finishBossCast(...)` clears cast/animation and records `lastAbilityId`.
7. **Ability Handlers**: `toxic_drop_marker` telegraphs targeted tiles, tracks burst sequence, applies toxic explosions, VFX, and `PLAYER_HIT`; `checkerboard_ignition` builds arena patterns (`CHECKERBOARD`, `SNAKE`, `INWARD_COLLAPSE`) and writes warning/active tile effects; `poison_flamethrower` locks aim, recomputes beam geometry from boss origin, ticks DOT-style player damage on circle intersection, and drives movement lock.
8. **Arena Effects**: `createBossArenaSequenceRuntime(...)` expands authored `ArenaActionSpec[]`; `syncBossArenaSequence(...)` maps cast elapsed time to `PENDING`, `WARNING`, `ACTIVE`, `DONE` and upserts `arenaTileEffects`. `updateArenaTileEffects(...)` decrements TTL, advances tick timers, and damages player only for `ACTIVE` configured-damage effects under the player. Cast cleanup removes hazard ids.
9. **Defeat / Integration**: boss death routes through `finalizeEnemyDeath(...)`, which calls `markBossEncounterDefeated(...)`: status `DEFEATED`, clear cast/animation, remove encounter tile effects, clear matching `activeEncounterId`. Other systems read boss runtime through objective tracking, `bossAlive(...)`, active boss HUD lookup, and render collectors.

## Invariants

- Boss encounters live in `world.bossRuntime`, not `eBrain`.
- Registered boss actors must stamp `eBossId`; definition lookup is id-driven.
- `status` and `activationState` are separate; `status: "ACTIVE"` can still be dormant.
- Each encounter owns at most one `activeCast`.
- Per-ability cooldown stamps on cast entry to `ACTIVE`, not cast creation.
- Boss movement uses boss config plus dormant/cast-lock gates, not standard hostile brain state.
- `arenaTileEffects` are encounter-scoped and must be removed on cast cleanup or defeat.
- `spawnActBossEncounterFromActiveMap(...)` requires authored `bossSpawn`.
- Live ability selection is cursor-based and currently ignores `weight`, `priority`, `constraints`, and `cooldownGroup`.

## Constraints

- Boss state must stay separate from generic hostile brain/action runtime; bosses are not `EnemyBrainState` extensions.
- Spawn/registration must flow through `spawnBossEncounter(...)` and `registerBossEncounter(...)`; manual `EnemyId.BOSS` insertion bypasses encounter binding.
- Bypassing `setCastPhase(...)`, `stepBossCastPhase(...)`, or `finishBossCast(...)` breaks cooldowns, animation requests, phase hooks, and cleanup.
- Arena hazards must use `arenaTileEffects` and arena-sequence helpers, not render-only overlays or unrelated damage checks.
- Defeat cleanup must route from shared enemy finalization into `markBossEncounterDefeated(...)` so objectives and hazards stay coherent.

## Dependencies

### Incoming

- World enemy SoA and boss runtime fields from `src/engine/world/world.ts`
- Active-map `bossSpawn`, walkability, blocked tiles from `src/game/map/authoredMapActivation.ts`, `src/game/map/compile/kenneyMap.ts`, `src/game/world/semanticFields.ts`
- Floor `bossId` / objective id from `src/game/game.ts`
- Position/aim/beam helpers from `src/game/coords/worldViews.ts`, `src/game/combat/aimPoints.ts`, `src/game/systems/sim/beamShared.ts`
- Player damage, armor, momentum helpers from `src/game/systems/sim/playerArmor.ts`, `src/game/systems/sim/momentum.ts`
- Generic enemy finalization from `src/game/systems/enemies/finalize.ts`

### Outgoing

- `bossRuntime` for objective tracking, movement/collision gates, HUD boss bar, animation/render collection
- `arenaTileEffects` for hazard ticking and rendering
- Boss actor tags through `eBossId`
- `PLAYER_HIT` and `VFX` events from abilities/hazards
- Defeat state for progression/run completion

## Extension

- New boss: `BossId`, `BOSSES`, and act-boss planning data if selectable
- New ability: `BossAbilityId`, `BOSS_ABILITIES`, `bossAbilityHandlers`, and needed `BossCastRuntimeState` fields
- New arena pattern: `ArenaPatternKind`, `generateArenaPattern(...)`, authored `patternSequence`
- New engagement/movement locks: boss-runtime helpers, not scattered checks

## Failure Modes

- Spawning with `spawnEnemyGrid(...)` or direct `world.e*` writes creates no registered encounter; `spawnEnemyGrid(...)` rejects `EnemyId.BOSS`.
- Assuming loadout `weight`, `priority`, `constraints`, or `cooldownGroup` affect runtime selection is currently wrong.
- Missing `bossSpawn` on an act-boss map throws at floor load.
- Manual `activeCast` / `requestedAnimation` writes bypass phase hooks, cooldown stamping, and cleanup.
- Uncleared arena effect ids leave stale hazards after cast cleanup/defeat.
- Killing a boss outside shared finalization skips defeat marking, objective tracking, and hazard cleanup.
- Treating dormant bosses as normal movers/contact enemies conflicts with explicit movement/contact skips.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
