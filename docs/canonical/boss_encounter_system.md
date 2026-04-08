# Boss Encounter System

## Purpose

- Own the runtime for registered boss encounters: boss actor spawn/registration, dormant-to-active engagement, per-encounter cast state, arena hazard sequencing, and defeat cleanup.
- Convert a floor-selected boss and boss map anchor into a live encounter whose state can drive objective completion, render/hud outputs, and boss-specific player damage.

## Scope

- Boss runtime fields in the world model:
  - `bossRuntime`
  - `arenaTileEffects`
  - boss-tagged enemy rows via `eBossId`
  in `src/engine/world/world.ts`
- Floor-load hookup that spawns act-boss encounters and the top-level encounter update call in:
  - `src/game/game.ts`
- Boss content registries and runtime types in:
  - `src/game/bosses/bossTypes.ts`
  - `src/game/bosses/bossDefinitions.ts`
  - `src/game/bosses/bossAbilities.ts`
  - `src/game/bosses/bossRegistry.ts`
- Boss encounter registration, lookup, activation, and defeat-state bookkeeping in:
  - `src/game/bosses/bossRuntime.ts`
- Boss actor spawn and act-boss map spawn resolution in:
  - `src/game/bosses/spawnBossEncounter.ts`
- Per-frame boss encounter ticking in:
  - `src/game/bosses/bossSystem.ts`
- Boss cast selection, cast phase progression, beam runtime, world effects, and ability-specific handlers in:
  - `src/game/bosses/bossAbilityRunner.ts`
- Boss arena construction and arena action sequencing in:
  - `src/game/bosses/bossArena.ts`
  - `src/game/bosses/bossArenaPatterns.ts`
  - `src/game/bosses/bossArenaActions.ts`
  - `src/game/bosses/bossArenaTypes.ts`
- Persistent arena-tile hazard runtime and damage ticking in:
  - `src/game/bosses/arenaTileEffects.ts`

## Non-scope

- Act-boss floor selection and map choice in `src/game/bosses/actBossPlan.ts`
- Generic enemy movement, collision, projectile, and death-resolution systems, except where they explicitly consume boss runtime state
- Objective progression, reward scheduling, and floor advancement, except where this system exposes boss encounter state for them to read
- Rendering, HUD composition, and boss-bar drawing; those systems consume boss runtime outputs
- Generic hostile spawn pacing and enemy brain-state logic; bosses do not use the standard hostile brain/action pipeline

## Key Entrypoints

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

## Data Flow / Pipeline

1. **Boss Runtime Reset and Floor-Load Hookup**
   - `clearFloorEntities(...)` in `game.ts` resets enemy arrays and calls `resetBossRuntime(world)`.
   - On floor load, `beginFloorLoad(...)` wires the objective spec first, then, for `ACT_BOSS` floors with a resolved `bossId`, calls `spawnActBossEncounterFromActiveMap(...)`.
   - The current live game path spawns at most one boss encounter per act-boss floor, even though `bossRuntime.encounters` is an array.

2. **Boss Actor Spawn and Encounter Registration**
   - `spawnActBossEncounterFromActiveMap(...)` reads `activeMap.semanticData.bossSpawn` and throws if the authored boss map is missing that semantic anchor.
   - `spawnBossEncounter(...)`:
     - resolves the boss definition from `bossRegistry`
     - converts the target world position to grid
     - spawns the actor through `spawnHostileActorGrid(...)`
     - stamps `EnemyId.BOSS` plus `eBossId`
     - scales HP and contact damage from `world.delveScaling`
   - `registerBossEncounter(...)` then creates a `BossEncounterState` with:
     - unique encounter id
     - `status: "ACTIVE"`
     - `activationState: "DORMANT"` or `"ACTIVE"`
     - `activeCast = null`
     - per-ability cooldown map
     - round-robin ability cursor
   - If an objective id is supplied, the encounter is bound through `objectiveToEncounterId`.

3. **Dormant Encounter Activation**
   - `bossEncounterSystem(world, dt)` is called from the main run loop after relic-on-kill sidecars and before zones/DOT progression work.
   - It updates `arenaTileEffects` first, then iterates active encounters.
   - For encounters with `activationState === "DORMANT"`:
     - the system compares player tile distance to boss tile distance
     - if the player is within `boss.engageDistanceTiles`, `activateBossEncounter(...)` flips activation state to `"ACTIVE"`
   - While dormant:
     - movement skips the boss
     - contact collisions skip the boss
     - the encounter does not cast abilities

4. **Boss Movement Contract**
   - Bosses do not use `eBrain` or the standard hostile behavior/action systems.
   - `movementSystem(...)` treats boss actors as generic enemy movers using boss movement config from `BossDefinition`.
   - Boss movement is additionally gated by boss runtime:
     - dormant encounters do not move
     - `isBossMovementLockedByCast(...)` currently locks movement during `POISON_FLAMETHROWER` while its cast phase is `"ACTIVE"`

5. **Ability Selection and Cast Creation**
   - When an encounter is active, alive, not already casting, and not blocked by `globalCooldownLeftSec`, `bossEncounterSystem(...)` calls `selectAbilityForEncounter(...)`.
   - `selectAbilityForEncounter(...)` scans the boss `abilityLoadout` starting at `nextAbilityCursor` and returns the first ability whose individual cooldown is clear.
   - The returned ability starts a cast through `beginBossCast(...)`, which:
     - builds a `BossCastRuntimeState`
     - stores target world/tile data
     - initializes any beam, world-effect, burst, or arena-sequence runtime
     - sets `encounter.activeCast`
     - publishes `requestedAnimation`
   - `bossEncounterSystem(...)` then applies a small `globalCooldownLeftSec = 0.15` after beginning the cast.

6. **Cast Phase State Machine**
   - Casts use the phase machine:
     - `TELEGRAPH`
     - `ACTIVE`
     - `RESOLVE`
     - `COOLDOWN`
   - `stepBossCastPhase(...)` advances the active cast using authored phase durations from the selected ability.
   - Zero-duration phases are skipped immediately through repeated phase transitions.
   - `setCastPhase(...)` is the authority for:
     - resetting phase timers
     - updating `requestedAnimation`
     - stamping per-ability cooldown at entry to `ACTIVE`
     - firing per-ability phase hooks
   - `finishBossCast(...)` performs final cleanup, clears `activeCast`, stores `lastAbilityId`, and clears `requestedAnimation`.

7. **Ability-Specific Execution**
   - `toxic_drop_marker`
     - starts with a telegraph world effect on the targeted tile
     - tracks a burst sequence against the player's current tile over time
     - applies toxic explosions tile-by-tile, emitting VFX and `PLAYER_HIT`
   - `checkerboard_ignition`
     - builds a playable boss arena around the anchor tile
     - generates authored arena patterns (`CHECKERBOARD`, `SNAKE`, `INWARD_COLLAPSE`)
     - synchronizes warning/active phases into arena tile effects
   - `poison_flamethrower`
     - builds a beam runtime locked to the boss's aim direction at cast start
     - recomputes beam geometry from the boss origin while keeping the locked direction
     - applies repeated DOT-style player damage ticks when the beam intersects the player circle
     - drives the movement-lock contract mentioned above

8. **Arena Sequence and Arena Tile Effects**
   - `createBossArenaSequenceRuntime(...)` expands authored `ArenaActionSpec[]` into selected cells/tiles plus per-action runtime state.
   - `syncBossArenaSequence(...)` is the authority that maps cast elapsed time to arena action phases:
     - `PENDING`
     - `WARNING`
     - `ACTIVE`
     - `DONE`
   - Warning and active actions write/update `arenaTileEffects` through `upsertArenaTileEffect(...)`.
   - `updateArenaTileEffects(...)`:
     - decrements TTL
     - advances tick timers
     - damages the player only when:
       - the effect is in `ACTIVE`
       - damage is configured
       - the player is standing on an affected tile
   - `clearBossArenaSequence(...)` and `removeArenaTileEffectsByIds(...)` remove hazard state on cast cleanup.

9. **Defeat Cleanup and External Integration**
   - Boss death still routes through `finalizeEnemyDeath(...)` in the generic enemy-finalization path.
   - `finalizeEnemyDeath(...)` calls `markBossEncounterDefeated(...)`, which:
     - marks the encounter `DEFEATED`
     - clears `activeCast`
     - clears `requestedAnimation`
     - removes all `arenaTileEffects` for that encounter
     - clears `activeEncounterId` if it pointed at that encounter
   - Other systems then consume boss runtime state:
     - objective tracking via `getTrackedBossEncounterForObjective(...)`
     - hostile-spawn gating via `bossAlive(...)`
     - HUD boss bar via `getActiveBossEncounter(...)` and boss HP
     - rendering of boss animations, boss beam VFX, cast world effects, and arena overlays

## Core Invariants

- Boss encounters are tracked in `world.bossRuntime`, not in `eBrain`.
- Registered boss actors must stamp `eBossId`; boss lookup is definition-driven from that string id.
- `BossEncounterState.status` and `activationState` are separate contracts:
  - a boss can be `status: "ACTIVE"` while still `activationState: "DORMANT"`
- Each encounter owns at most one `activeCast` at a time.
- Boss ability phase order is authoritative:
  - `TELEGRAPH` -> `ACTIVE` -> `RESOLVE` -> `COOLDOWN` -> cleanup
- Per-ability cooldown is applied when a cast enters `ACTIVE`, not when the cast is first created.
- Boss movement currently bypasses the standard hostile-brain system and uses boss movement config directly, with additional dormant/cast-lock gates from boss runtime.
- `arenaTileEffects` are encounter-scoped; boss defeat or cast cleanup must remove the effects for that encounter.
- `spawnActBossEncounterFromActiveMap(...)` requires an authored `bossSpawn` semantic on the active map.
- Live ability selection is cursor-based over `abilityLoadout` and currently ignores `weight`, `priority`, `constraints`, and `cooldownGroup`.

## Design Constraints

- Boss encounter state must remain separate from the generic hostile brain/action runtime. Bosses are not authored by extending `EnemyBrainState`.
- Boss spawn/registration must continue to flow through `spawnBossEncounter(...)` and `registerBossEncounter(...)`. Manual `EnemyId.BOSS` insertion is not a valid encounter path.
- Boss cast progression must continue to use the explicit phase machine in `bossAbilityRunner.ts`; bypassing `setCastPhase(...)`, `stepBossCastPhase(...)`, or `finishBossCast(...)` breaks cooldowns, animation requests, and cleanup.
- Arena hazards must continue to flow through `arenaTileEffects` and arena-sequence helpers, not through ad hoc render-only overlays or one-off damage checks in unrelated systems.
- Defeat cleanup must continue to route through `markBossEncounterDefeated(...)` from shared enemy finalization so encounter status, objective tracking, and arena cleanup stay consistent.

## Dependencies (In/Out)

### Incoming

- World state, enemy SoA storage, and boss runtime fields from `src/engine/world/world.ts`
- Active-map semantic boss spawn and walkability/blocked-tile data from:
  - `src/game/map/authoredMapActivation.ts`
  - `src/game/map/compile/kenneyMap.ts`
  - `src/game/world/semanticFields.ts`
- Floor-selected `bossId` / objective id from the floor-load and progression pipeline in `src/game/game.ts`
- Player position, enemy aim, and beam geometry helpers from:
  - `src/game/coords/worldViews.ts`
  - `src/game/combat/aimPoints.ts`
  - `src/game/systems/sim/beamShared.ts`
- Player-damage, armor, and momentum helpers from:
  - `src/game/systems/sim/playerArmor.ts`
  - `src/game/systems/sim/momentum.ts`
- Generic enemy finalization from `src/game/systems/enemies/finalize.ts`

### Outgoing

- `bossRuntime` state consumed by:
  - objective tracking
  - movement/collision dormant and cast-lock checks
  - HUD boss-bar selection
  - boss animation/render collection
- `arenaTileEffects` consumed by:
  - boss hazard ticking
  - ground/effect rendering
- Boss actor tags in enemy arrays through `eBossId`
- `PLAYER_HIT` and `VFX` events emitted by boss abilities and arena hazards
- Defeat state used by progression and run-completion logic

## Extension Points

- Add a new boss by extending:
  - `BossId`
  - `BOSSES`
  - any act-boss planning data if the boss should appear in act selection
- Add a new boss ability by extending:
  - `BossAbilityId`
  - `BOSS_ABILITIES`
  - `bossAbilityHandlers`
  - any new cast-runtime fields needed in `BossCastRuntimeState`
- Add a new arena pattern by extending:
  - `ArenaPatternKind`
  - `generateArenaPattern(...)`
  - authored `patternSequence` definitions
- Add new engagement or movement-lock rules by extending boss-runtime helpers, not by scattering direct checks across unrelated systems

## Failure Modes / Common Mistakes

- Spawning a boss through `spawnEnemyGrid(...)` or by writing directly into `world.e*` arrays creates no registered encounter and bypasses objective binding; `spawnEnemyGrid(...)` also rejects `EnemyId.BOSS`.
- Assuming boss loadout `weight`, `priority`, `constraints`, or `cooldownGroup` fields affect runtime selection is incorrect in the current implementation.
- Omitting the `bossSpawn` semantic from an act-boss map will make `spawnActBossEncounterFromActiveMap(...)` throw at floor load.
- Writing `encounter.activeCast` or `requestedAnimation` manually bypasses phase hooks, cooldown stamping, and cleanup.
- Leaving arena-tile effect ids uncleared after cast cleanup or defeat produces stale boss hazards.
- Killing a boss without routing through shared enemy finalization skips `markBossEncounterDefeated(...)`, which leaves objective tracking and hazard cleanup inconsistent.
- Treating dormant bosses as normal movers/contact enemies is wrong; movement and player-contact collision explicitly skip dormant encounters.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
