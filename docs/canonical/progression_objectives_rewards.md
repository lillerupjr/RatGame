# Progression / Objectives / Rewards

## Purpose

Own floor progression: trigger facts, objective intent, kill/zone/chest/level milestones, interaction completions, reward queues, reward presentation, countdown-to-exit, floor advancement, run outcome, and run heat.

## Scope

- Floor reset, objective wiring, reward orchestration, countdown, advance handling, run heat in `src/game/game.ts`
- Progression fields in `src/engine/world/world.ts`
- Objective mapping/runtime: `src/game/systems/progression/objectiveSpec.ts`, `objective.ts`
- Trigger registry/signals: `triggerSystem.ts`
- Zone/rare/room objectives: `src/game/objectives/zoneObjectiveSystem.ts`, `zoneObjectiveTypes.ts`, `rareTripleObjectiveSync.ts`, `rareZoneSpawn.ts`, `roomChallenge.ts`
- Drops/pickups/XP: `drops.ts`, `pickups.ts`, `src/game/economy/xp.ts`
- Run events/reward tickets/director/presenter: `rewardRunEventProducerSystem.ts`, `rewardSchedulerSystem.ts`, `rewardPresenterSystem.ts`, `src/game/rewards/runEvents.ts`, `rewardTickets.ts`, `rewardDirector.ts`, `floorRewardBudget.ts`
- Outcomes/countdown/heat: `outcomeSystem.ts`, `floorEndCountdown.ts`, `runHeat.ts`
- Vendor floors: `src/game/vendor/vendorState.ts`, `generateVendorProgressionOffers.ts`, `vendorPurchase.ts`

## Non-scope

- Movement/combat/projectile/DOT execution that emits facts: `docs/canonical/core_simulation_combat_runtime.md`
- Hostile spawn/AI and boss runtime: `docs/canonical/hostile_ai_spawn_runtime.md`, `docs/canonical/boss_encounter_system.md`
- Map compilation/floor intent generation: `docs/canonical/map_compilation_activation_floor_topology.md`
- Dialog/reward/vendor/HUD UI layout: `docs/canonical/ui_shell_menus_runtime_panels.md`
- Ring option generation/stat application beyond opening/apply path: `docs/canonical/combat_mods_stat_resolution_loadout_effects.md`
- Audio/VFX rendering

## Entrypoints

- `src/engine/world/world.ts`
- `src/game/game.ts`
- `src/game/systems/progression/objectiveSpec.ts`
- `src/game/systems/progression/objective.ts`
- `src/game/systems/progression/triggerSystem.ts`
- `src/game/objectives/zoneObjectiveSystem.ts`
- `src/game/objectives/zoneObjectiveTypes.ts`
- `src/game/systems/progression/rareTripleObjectiveSync.ts`
- `src/game/systems/progression/rareZoneSpawn.ts`
- `src/game/systems/progression/roomChallenge.ts`
- `src/game/systems/progression/drops.ts`
- `src/game/systems/progression/pickups.ts`
- `src/game/economy/xp.ts`
- `src/game/systems/progression/rewardRunEventProducerSystem.ts`
- `src/game/systems/progression/rewardSchedulerSystem.ts`
- `src/game/systems/progression/rewardPresenterSystem.ts`
- `src/game/rewards/runEvents.ts`
- `src/game/rewards/rewardTickets.ts`
- `src/game/rewards/rewardDirector.ts`
- `src/game/rewards/floorRewardBudget.ts`
- `src/game/systems/progression/outcomeSystem.ts`
- `src/game/systems/progression/floorEndCountdown.ts`
- `src/game/systems/progression/runHeat.ts`
- `src/game/vendor/vendorState.ts`
- `src/game/vendor/generateVendorProgressionOffers.ts`
- `src/game/vendor/vendorPurchase.ts`

## Pipeline

1. **Floor Entry Reset / Wiring**: `beginFloorLoad(...)` calls `resetFloorProgressionState(world)`, clearing `triggerSignals`, `objectiveEvents`, `events`, `chestOpenRequested`, `runEvents`, `rewardTickets`, `activeRewardTicketId`, reward-producer dedupe state, countdown fields, `floorClearCommitted`, `pendingAdvanceToNextFloor`, `rareZoneSpawned`. Then it wires `currentObjectiveSpec`, `objectiveDefs`/`objectiveStates`, `floorRewardBudget`, zone trial runtime/nav mirrors, rare nav mirrors, and vendor offers for `VENDOR`.
2. **Trigger / Challenge Facts**: `triggerSystem(...)` rebuilds registry on active-map or overlay-trigger version changes, clears `triggerSignals`, and emits `ENTER`, `EXIT`, `INTERACT`, `KILL`, `TICK` from active-map and overlay trigger defs. `roomChallengeSystem(...)` manages room locks; `onEnemyKilledForChallenge(...)` tracks progress; `canExitRoom(...)` gates movement.
3. **Objective Sidecars**: zone trials consume `ENEMY_KILLED`, count kills inside zones, enqueue first two `ZONE_CLEARED` run events, and emit synthetic `KILL` for `OBJ_ZONE_TRIAL_COMPLETE`; rare-zone entry spawns one hostile per rare zone and stamps `eSpawnTriggerId`; rare-triple sync marks clears from trigger signals and kill events.
4. **Objective Resolution**: `objectiveSystem(world)` resolves `objectiveDefs` + `objectiveStates`. `SIGNAL_COUNT` counts matching signals by event count or `TICK` dt; `TRACK_BOSS_KILL` polls boss runtime. Status transitions emit `objectiveEvents`. Heal/vendor direct completions still use `completeObjectiveById(...)`; rewards still observe them because producer watches `objectiveStates`. Rare-triple state reconciles after objective resolution.
5. **Drops / XP / Run Facts**: `dropsSystem(...)` converts `ENEMY_KILLED` to gold pickups and handles physical pickup collection. Gold pickup calls `grantXp(...)`, which mutates XP/level and emits `LEVEL_UP` run events. Chest pickup sets `world.chestOpenRequested`. `rewardRunEventProducerSystem(...)` captures durable facts into `runEvents`: objective completions, rare milestones by trigger attribution, survive-trial 60s, chest-open requests, with internal seen maps/sets.
6. **Reward Scheduling**: `rewardSchedulerSystem(...)` drains `runEvents`, assigns floor-scoped claim keys, ignores repeated `rewardClaimKeys`, stores objective/zone claimed keys, grants flat `OBJECTIVE_COMPLETION_GOLD`, and plans via `rewardDirector.ts`: `OBJECTIVE_COMPLETED -> GRANT_PROGRESSION_REWARD`; zone/rare/survive/chest currently `NO_REWARD`; level-up grants a ring level-up token directly; `GRANT_GOLD` applies immediately; valid `GRANT_PROGRESSION_REWARD` enqueues a typed reward ticket.
7. **Reward Presentation**: `runRewardPipeline(...)` runs facts in two phases: core facts before audio, chest facts after audio so chest SFX is not skipped. `rewardPresenterSystem(...)` runs only in `RUN`, refuses if reward UI active, activates oldest ticket, calls `beginProgressionReward(...)`, and sets `world.state = "REWARD"` only when menu opens. Reward callback chooses a progression option, resolves ticket, re-renders, then advances or returns to `RUN`.
8. **Countdown / Advancement**: after objective resolution and first reward pass, `maybeStartFloorEndCountdown(...)` starts once per completed floor after at least one objective complete. `tickFloorEndCountdown(...)` advances timer; finish closes reward UI and retries advancement. Built-in objective specs have empty `outcomes`, so normal completion uses `tryAdvanceAfterObjectiveCompletion()`: require complete objective, block during reward/countdown, commit clear once, increment `runHeat`, then choose deterministic picker, delve destination, final victory, or next floor. Vendor/heal use `pendingAdvanceToNextFloor` until interaction UI closes.
9. **Vendor Floors**: vendor floor load seeds `world.vendor` with typed progression offers; `tryPurchaseVendorOffer(...)` checks gold, prevents repeat purchase, deducts gold, applies the selected progression option, and marks the offer sold. Leaving vendor completes `OBJ_VENDOR`, sets `pendingAdvanceToNextFloor`, then normal reward/advance path resolves.

## Invariants

- Floor progression reset precedes new objective wiring.
- `currentObjectiveSpec`, `objectiveDefs`, and `objectiveStates` are authoritative objective model.
- `triggerSignals` is a transient per-frame buffer cleared by `triggerSystem(...)`; sidecars may append later that frame.
- `objectiveSystem(...)` is signal-driven, but reward capture observes `objectiveStates`, not only `objectiveEvents`.
- `objectiveEvents` records transitions only; it is not long-lived truth.
- Queues: `runEvents` bridges fact capture -> scheduler; `rewardTickets` bridges scheduler -> presenter.
- Reward dedupe requires producer seen-state plus scheduler `rewardClaimKeys`.
- `rewardPresenterSystem(...)` is the runtime path that opens reward UI and sets `world.state = "REWARD"`.
- Current reward planning grants progression-reward tickets only for `OBJECTIVE_COMPLETED`.
- `grantXp(...)` owns XP/level mutation and `LEVEL_UP` run events.
- `commitFloorClear(...)` runs at most once per floor; `runHeat` increments only through clear commit.
- Standard floor completion bypasses `outcomeSystem(...)`; advancement is explicit in `game.ts`.
- Vendor/heal complete via direct objective-state mutation plus deferred advancement, not triggers alone.

## Constraints

- Layer order stays trigger/objective facts -> `runEvents` -> reward planning -> `rewardTickets` -> reward UI / advancement.
- Objective rewards must be offered before floor advancement; chest-triggered rewards stay after audio to preserve chest SFX.
- New rewardable run events need stable claim keys and scheduler plans.
- Objective completion must remain observable from `objectiveStates` because some paths complete imperatively.
- Run heat remains single-commit per cleared floor.

## Dependencies

### Incoming

- World progression fields from `src/engine/world/world.ts`
- Active-map and overlay trigger defs plus map walkability
- `ENEMY_KILLED`, chest-open requests, room-exit pressure from sim/combat
- Boss runtime from `src/game/bosses/bossRuntime.ts`
- Progression reward option/apply path from `src/game/progression/rewards/progressionRewardFlow.ts`
- Gold/XP helpers, vendor offer generation, ring progression registries, UI callbacks in `game.ts`

### Outgoing

- Objective state: `objectiveDefs`, `objectiveStates`, `objectiveEvents`
- Queues/claims: `runEvents`, `rewardTickets`, `rewardClaimKeys`, `activeRewardTicketId`, objective/zone claimed keys
- Floor control: `floorEndCountdown*`, `pendingAdvanceToNextFloor`, `floorClearCommitted`, `runHeat`, `delveScaling`
- Navigation mirrors: `zoneTrial`, `rareTriple`
- `world.state = "REWARD"` on reward menu open
- `world.vendor` offer/sold state

## Extension

- Objective family: `ObjectiveSpec`, `objectiveSpecToObjectiveDefs(...)`, sidecar facts/events
- Rewardable milestone: `RunEvent`, producer, `claimKeyForRunEvent(...)`, `rewardPlanForRunEvent(...)`, ticket/presenter UI
- Outcomes: `outcomeHandlers` in `outcomeSystem.ts`
- Vendor reward types: offer state, purchase validation, effect application
- Zone/rare modes: sidecar systems without overloading base objective counting

## Failure Modes

- Missing reset causes stale instant completion or duplicate rewards.
- `objectiveEvents` alone miss vendor/heal direct completions.
- New `RunEvent` without claim key/plan can no-op or duplicate rewards.
- Direct reward UI opens break ordering, dedupe, and advancement gating.
- Advancing before reward pipeline skips rewards/UI.
- Expecting `outcomeSystem(...)` to handle normal completion is wrong today.
- Rare/zone milestones use completion order for first two rewards, not fixed trigger identity.
- XP outside `grantXp(...)` skips level-up run events and skill-point grants.
- Current vendor purchases must use `tryPurchaseVendorOffer(...)`, not unused event-driven `vendorSystem.ts`.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
