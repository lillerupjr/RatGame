# Progression / Objectives / Rewards

## Purpose

- Own the floor-level progression runtime that turns trigger facts, objective intent, kill/zone/chest/level milestones, and interaction completions into objective state, reward queues, reward presentation, countdown-to-exit behavior, and advancement to the next floor or run outcome.
- Convert transient gameplay facts into durable progression state through explicit buffers:
  - `triggerSignals`
  - `objectiveStates` / `objectiveEvents`
  - `runEvents`
  - `rewardTickets`

## Scope

- Floor-scoped progression reset, objective wiring, reward-pipeline orchestration, floor-end countdown, pending-advance handling, and run-heat commit hooks in:
  - `src/game/game.ts`
- World-owned progression/runtime fields in:
  - `src/engine/world/world.ts`
- Objective spec mapping, objective runtime state, and objective resolution in:
  - `src/game/systems/progression/objectiveSpec.ts`
  - `src/game/systems/progression/objective.ts`
- Trigger registry refresh and per-frame trigger signal emission in:
  - `src/game/systems/progression/triggerSystem.ts`
- Zone-trial runtime, zone-cleared milestones, and zone overlay sync inputs in:
  - `src/game/objectives/zoneObjectiveSystem.ts`
  - `src/game/objectives/zoneObjectiveTypes.ts`
- Rare-triple milestone sync and rare-zone encounter spawning in:
  - `src/game/systems/progression/rareTripleObjectiveSync.ts`
  - `src/game/systems/progression/rareZoneSpawn.ts`
- Room-challenge room locks and kill-count challenge state in:
  - `src/game/systems/progression/roomChallenge.ts`
- Drop spawning, pickup collection, XP gain, and level-up run-event production in:
  - `src/game/systems/progression/drops.ts`
  - `src/game/systems/progression/pickups.ts`
  - `src/game/economy/xp.ts`
- Reward event capture, reward claim/ticket queues, reward planning, and reward presentation in:
  - `src/game/systems/progression/rewardRunEventProducerSystem.ts`
  - `src/game/systems/progression/rewardSchedulerSystem.ts`
  - `src/game/systems/progression/rewardPresenterSystem.ts`
  - `src/game/rewards/runEvents.ts`
  - `src/game/rewards/rewardTickets.ts`
  - `src/game/rewards/rewardDirector.ts`
  - `src/game/rewards/floorRewardBudget.ts`
- Objective outcome application, floor-end countdown, and run-heat commit helpers in:
  - `src/game/systems/progression/outcomeSystem.ts`
  - `src/game/systems/progression/floorEndCountdown.ts`
  - `src/game/systems/progression/runHeat.ts`
- Vendor floor offer state and purchase flow in:
  - `src/game/vendor/vendorState.ts`
  - `src/game/vendor/generateVendorRelics.ts`
  - `src/game/vendor/vendorPurchase.ts`

## Non-scope

- Core movement, collision, projectile, DOT, and hostile-combat execution; this system consumes their emitted facts
- Hostile spawn pacing, enemy brain/action logic, and boss encounter runtime
- Map compilation and floor-intent generation; this system consumes `currentObjectiveSpec` and active-map trigger data
- UI layout and DOM rendering for dialogs, reward menus, vendor menus, or HUD overlays
- Relic option generation, relic stat application, and combat-mod effect resolution, beyond this system opening the reward flow and invoking the existing apply path
- Audio and VFX rendering, even when progression emits events those systems consume

## Key Entrypoints

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
- `src/game/vendor/generateVendorRelics.ts`
- `src/game/vendor/vendorPurchase.ts`

## Data Flow / Pipeline

1. **Floor Entry and Progression Reset**
   - `game.ts:beginFloorLoad(...)` calls `resetFloorProgressionState(world)` before new objective wiring.
   - The reset path clears floor-scoped progression buffers and guards:
     - `triggerSignals`
     - `objectiveEvents`
     - `events`
     - `chestOpenRequested`
     - `runEvents`
     - `rewardTickets`
     - `activeRewardTicketId`
     - reward-producer dedupe maps/counters
     - floor-end countdown fields
     - `floorClearCommitted`
     - `pendingAdvanceToNextFloor`
     - `rareZoneSpawned`
   - The same load path then wires progression for the new floor:
     - `currentObjectiveSpec`
     - `objectiveDefs` / `objectiveStates` through `initObjectivesForFloor(...)`
     - `floorRewardBudget` from `objectiveModeForFloor(...)`
     - zone-trial runtime via `startZoneTrial(...)`
     - zone/rare navigation mirrors via `syncZoneTrialNavState(...)` and `syncRareTripleNavState(...)`
     - vendor offer state for `VENDOR` floors via `createVendorState(generateVendorRelicOffers(...))`

2. **Per-Frame Trigger and Challenge Fact Capture**
   - `triggerSystem(...)` rebuilds `triggerRegistry` when the active map or overlay-trigger version changes.
   - It clears `world.triggerSignals` each frame, then emits:
     - `ENTER`
     - `EXIT`
     - `INTERACT`
     - `KILL`
     - `TICK`
   - Trigger sources include active-map trigger defs plus `overlayTriggerDefs`.
   - `roomChallengeSystem(...)` runs earlier in the frame and manages kill-count room locks:
     - entering a challenge room activates the lock
     - `onEnemyKilledForChallenge(...)` increments progress from shared death finalization
     - `canExitRoom(...)` is the movement-side gate for leaving locked rooms

3. **Objective-Specific Sidecars**
   - `updateZoneTrialObjective(...)` consumes `ENEMY_KILLED` events while the player is inside an active zone-trial area.
   - Zone-trial completions:
     - increment per-zone kill counts
     - enqueue `ZONE_CLEARED` run events for the first two completed zones
     - emit a synthetic `KILL` trigger for `OBJ_ZONE_TRIAL_COMPLETE` once all zones are done
   - `syncZoneTrialNavState(...)` mirrors the hidden zone-trial runtime into `world.zoneTrial` for downstream overlay consumers.
   - `rareZoneSpawnSystem(...)` consumes `ENTER` signals for rare-zone overlay triggers, spawns exactly one hostile for each unspawned rare zone, and stamps `eSpawnTriggerId` for later kill attribution.
   - `markRareTripleClearsFromSignalsAndEvents(...)` marks rare-triple clear state from both trigger signals and kill events before objective resolution.

4. **Objective Resolution**
   - `objectiveSystem(world)` is the canonical resolver for `objectiveDefs` + `objectiveStates`.
   - `SIGNAL_COUNT` rules count matching trigger signals:
     - by event count for `ENTER` / `INTERACT` / `KILL`
     - by accumulated `dt` for `TICK`
   - `TRACK_BOSS_KILL` rules poll boss runtime through `getTrackedBossEncounterForObjective(...)`.
   - Status transitions to `COMPLETED` or `FAILED` emit `objectiveEvents`.
   - Direct imperative completions still exist in `game.ts` through `completeObjectiveById(...)` for:
     - heal-station confirmation
     - vendor leave
   - Because the reward producer watches `objectiveStates`, those direct completions still feed the reward pipeline even though they do not emit `objectiveEvents` themselves.
   - After `objectiveSystem(...)`, `syncRareTripleObjectiveStateFromClears(...)` reconciles the rare-triple objective state from the floor's tracked rare clears.

5. **Drop, XP, and Run-Fact Production**
   - `dropsSystem(...)` converts `ENEMY_KILLED` events into gold pickups and handles physical pickup collection.
   - Gold pickups call `grantXp(...)`, which owns run XP/level state and enqueues `LEVEL_UP` run events.
   - Chest pickups route through `handlePickupSpecialCase(...)` and `handleChestPickup(...)`, which set `world.chestOpenRequested` for the later reward pipeline.
   - `rewardRunEventProducerSystem(...)` captures durable progression facts into `world.runEvents`:
     - objective completions from `objectiveStates`
     - rare milestones from kill-event trigger attribution
     - survive-trial 60-second milestone
     - chest-open requests
   - Objective and rare capture use internal seen maps/sets so one fact does not enqueue repeatedly across frames.

6. **Reward Scheduling and Claim Keys**
   - `rewardSchedulerSystem(...)` drains `world.runEvents` and assigns each event a floor-scoped claim key.
   - `rewardClaimKeys` is the durable dedupe list; repeated facts with the same claim key are ignored.
   - Scheduler side effects:
     - `OBJECTIVE_COMPLETED` stores `objectiveRewardClaimedKey`
     - zone/rare milestone events append `zoneRewardClaimedKey` / `zoneRewardClaimedKeys`
     - objective completion also grants a flat `OBJECTIVE_COMPLETION_GOLD` bonus
   - Reward planning currently routes through `rewardDirector.ts`:
     - `OBJECTIVE_COMPLETED` => `GRANT_RELIC`
     - zone, rare, survive, chest, and level-up reward events currently resolve to `NO_REWARD`
   - `GRANT_GOLD` is applied immediately.
   - `GRANT_RELIC` with a valid source enqueues a `RELIC_PICK` ticket into `world.rewardTickets`.

7. **Reward Presentation and UI State Handoff**
   - `runRewardPipeline(...)` is the top-level orchestration wrapper in `game.ts`.
   - It runs in two phases:
     - core facts before audio: objective/rare/survive/level-up
     - chest facts after audio, so chest pickup SFX is never skipped by an early reward-menu return
   - `rewardPresenterSystem(...)`:
     - only runs while `world.state === "RUN"`
     - refuses to open if reward UI is already active
     - activates the oldest pending reward ticket
     - calls `beginRelicReward(...)`
     - sets `world.state = "REWARD"` if a reward menu actually opened
   - The relic reward UI callback in `game.ts`:
     - chooses the relic
     - resolves the active reward ticket
     - re-renders reward state
     - then either advances immediately or returns the game to `RUN`

8. **Countdown, Outcomes, and Floor Advancement**
   - After objective resolution and the first reward-pipeline pass, `game.ts` may start the floor-end countdown through `maybeStartFloorEndCountdown(...)`.
   - The countdown only starts once per completed floor and only after at least one objective is complete.
   - `tickFloorEndCountdown(...)` advances the timer; `finishFloorEndCountdown()` closes reward UI state and re-attempts advancement.
   - `outcomeSystem(...)` applies `objectiveEvents` outcomes through a small handler table (`SET_RUN_STATE`, `SET_GAME_STATE`).
   - Current built-in objective specs define empty `outcomes`, so standard floor completion is driven by `tryAdvanceAfterObjectiveCompletion()`, not by `outcomeSystem(...)`.
   - `tryAdvanceAfterObjectiveCompletion()`:
     - requires a completed objective
     - refuses to advance during active reward UI or an in-progress countdown
     - commits floor clear once through `commitCurrentNodeClear(...)` / `commitFloorClear(...)`
     - increments `runHeat`
     - then resolves one of:
       - deterministic delve picker
       - delve-map destination choice
       - final run victory
       - ordinary next-floor completion
   - Vendor/heal interactions use `pendingAdvanceToNextFloor`; advancement is deferred until dialog/shop closure through `resolvePendingAdvanceAfterInteractionClose()`.

9. **Vendor Floor Progression**
   - Vendor floors are progression-owned floor states, not generic shop overlays.
   - Floor load seeds `world.vendor` with relic offers.
   - Purchases go through `tryPurchaseVendorRelic(...)`, which:
     - checks gold
     - prevents duplicate relic ownership
     - deducts gold
     - applies the relic
     - marks the offer sold
   - Leaving the vendor shop completes `OBJ_VENDOR`, sets `pendingAdvanceToNextFloor`, and lets the normal reward/advance path resolve after the UI closes.

## Core Invariants

- Floor progression state must be reset before new objective wiring. A new floor must not inherit trigger signals, objective events, run events, reward tickets, or countdown state from the previous floor.
- `currentObjectiveSpec`, `objectiveDefs`, and `objectiveStates` are the authoritative floor objective model.
- `triggerSignals` is a transient per-frame fact buffer. It is cleared by `triggerSystem(...)` before that frame's trigger evaluation and may be appended to later in the same frame by objective sidecars.
- `objectiveSystem(...)` is the canonical signal-driven objective resolver, but reward capture is based on `objectiveStates`, not only on `objectiveEvents`.
- `objectiveEvents` only records status transitions; it is not the long-lived source of objective truth.
- `world.runEvents` is the queue between progression fact capture and reward scheduling.
- `world.rewardTickets` is the queue between reward scheduling and reward presentation.
- Reward claim de-dup requires both:
  - producer-side seen state for noisy frame facts
  - scheduler-side `rewardClaimKeys` for durable claim semantics
- `rewardPresenterSystem(...)` is the only runtime path in this system that opens reward UI and sets `world.state = "REWARD"`.
- Current reward planning grants a relic ticket only for `OBJECTIVE_COMPLETED`. Zone, rare, survive, chest, and level-up run events currently do not open a reward menu.
- `grantXp(...)` is the authoritative level-up path; it owns run XP/level mutation and emits `LEVEL_UP` run events.
- `commitFloorClear(...)` must run at most once per cleared floor. `runHeat` increments through that commit path, not through ad hoc writes.
- Standard objective completion does not currently rely on `outcomeSystem(...)`; objective specs ship with empty `outcomes`, and floor advancement is driven by the explicit advance gate in `game.ts`.
- Vendor and heal progression complete through direct objective-state mutation plus deferred advancement, not through the trigger-system alone.

## Design Constraints

- The progression pipeline remains layered: trigger/objective facts -> `runEvents` -> reward planning -> `rewardTickets` -> reward UI / advancement. Skipping a layer changes replay, dedupe, and gating semantics.
- Reward/advance ordering in `game.ts` is architectural. Objective rewards must be offered before floor advancement, and chest-triggered rewards must remain after audio so chest SFX is preserved.
- Floor-scoped reset before `initObjectivesForFloor(...)` is mandatory. Removing or weakening that reset creates stale-state instant-completion bugs.
- Claim-key dedupe is mandatory for reward issuance. New rewardable run events must define a stable claim key and scheduler path.
- Objective completion must remain observable from `objectiveStates`, not only from `objectiveEvents`, because some current progression paths complete objectives imperatively.
- Run-heat progression must stay single-commit per cleared floor. Any alternative path that increments `runHeat` outside the clear-commit helper is drift.

## Dependencies (In/Out)

### Incoming

- World state, event buffers, and floor/run-state fields from `src/engine/world/world.ts`
- Active-map trigger defs, overlay trigger defs, and surface/walkability queries from the map system
- `ENEMY_KILLED` events, chest-open requests, and room-exit gating pressure from combat/sim systems
- Boss runtime status from `src/game/bosses/bossRuntime.ts` for `ACT_BOSS` objectives
- Relic reward option generation and reward application from `src/game/combat_mods/rewards/relicRewardFlow.ts`
- Gold and XP mutation helpers from the economy layer
- Vendor/relic content registries used to generate or apply relic offers
- UI callbacks in `game.ts` that choose rewards, confirm healing, or leave the vendor

### Outgoing

- Updated objective state in:
  - `objectiveDefs`
  - `objectiveStates`
  - `objectiveEvents`
- Progression queues and claim tracking in:
  - `runEvents`
  - `rewardTickets`
  - `rewardClaimKeys`
  - `activeRewardTicketId`
  - `objectiveRewardClaimedKey`
  - `zoneRewardClaimedKey`
  - `zoneRewardClaimedKeys`
- Floor progression control state in:
  - `floorEndCountdown*`
  - `pendingAdvanceToNextFloor`
  - `floorClearCommitted`
  - `runHeat`
  - `delveScaling`
- Navigation/overlay mirrors in:
  - `zoneTrial`
  - `rareTriple`
- `world.state = "REWARD"` when a reward menu is opened
- Vendor offer/sold state in `world.vendor`

## Extension Points

- Add a new objective family by extending:
  - `ObjectiveSpec`
  - `objectiveSpecToObjectiveDefs(...)`
  - any sidecar runtime that must emit matching trigger or run events
- Add a new rewardable milestone by extending:
  - `RunEvent`
  - `rewardRunEventProducerSystem(...)`
  - `claimKeyForRunEvent(...)`
  - `rewardPlanForRunEvent(...)`
  - reward ticket/presenter logic if it needs new UI
- Add new objective outcomes by extending `outcomeHandlers` in `outcomeSystem.ts`
- Add new vendor reward types by extending vendor offer state, purchase validation, and effect application
- Add new zone/rare progression modes by extending the zone-trial and rare-triple sidecar systems without overloading base objective counting semantics

## Failure Modes / Common Mistakes

- Forgetting `resetFloorProgressionState(...)` on floor load can cause immediate objective completion or duplicate rewards from stale queues.
- Assuming `objectiveEvents` alone drive rewards is incorrect; vendor/heal completions mutate `objectiveStates` directly.
- Adding a new `RunEvent` without a claim key or scheduler plan causes silent no-op rewards or duplicate reward issuance.
- Opening reward UI directly instead of going through reward tickets breaks ordering, dedupe, and advancement gating.
- Advancing the floor before the reward pipeline runs can skip objective rewards or bypass reward UI entirely.
- Expecting `outcomeSystem(...)` to handle normal floor completion is incorrect in the current runtime; built-in objective specs define empty `outcomes`.
- Treating rare or zone milestone rewards as fixed trigger identities is wrong; the reward pipeline currently uses completion order for the first two milestones.
- Granting XP outside `grantXp(...)` skips level-up run events and cluster-jewel skill-point grants.
- Wiring current vendor purchases through the unused event-driven `vendorSystem.ts` path would diverge from the live runtime, which purchases directly through `tryPurchaseVendorRelic(...)`.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
