Contract: Centralized Objective Authority and Removal of Boss Chest Progression Gating (Phased Execution)

Status: ACTIVE
Execution model: AGENTS.md phased execution
Scope: Objective authority, chest behavior, floor exit authority

Phase 0 — Define Authoritative Completion Predicate
Goal

Establish a single authoritative completion predicate used by all systems.

Implementation

Create a shared helper:

export function hasCompletedAnyObjective(world: World): boolean {
return world.objectiveStates.some(s => s.status === "COMPLETED");
}

Requirements:

This helper must live in the objective system module.

This helper must not reference any other fields.

This helper must not reference reward state, chest state, or UI state.

Replace usage

All systems that check objective completion MUST use this helper.

This includes:

floor exit countdown start

delve map advancement

floor transition logic

run completion logic

Forbidden

Do not modify any zoneTrialObjective or bossRewardPending logic yet.

Phase 0 is predicate definition only.

Achievements

- [x] Completion predicate exists

- [x] Completion predicate references only objectiveStates

- [x] Completion predicate has no side effects

Stop after completion
Phase 1 — Remove zoneTrialObjective
Goal

Remove parallel objective completion state.

Implementation

Delete from World schema:

zoneTrialObjective

Delete all reads:

world.zoneTrialObjective.completed

Delete all writes:

world.zoneTrialObjective.completed = true

Delete all fallbacks that convert zoneTrialObjective completion into objectiveStates completion.

Zone trial objectives must now complete via objective system only.

Migration rule

Zone trial completion must instead set:

objectiveStates[i].status = "COMPLETED"

through the objective system.

Forbidden

Do not modify bossRewardPending yet.

Do not modify chest behavior yet.

Achievements

- [x] zoneTrialObjective removed from world

- [x] No reads of zoneTrialObjective remain

- [x] No writes of zoneTrialObjective remain

- [x] Zone trials resolve through objectiveStates only

Invariants now true

Completion authority is objectiveStates only.

Stop after completion
Phase 2 — Remove bossRewardPending Progression Gating
Goal

Remove chest-based progression gating.

Implementation

Delete from World schema:

bossRewardPending

Delete all reads:

if (world.bossRewardPending)

Delete all writes:

world.bossRewardPending = true
world.bossRewardPending = false

Delete all progression logic referencing bossRewardPending.

Chest behavior preserved

Chest spawn remains.

Chest pickup remains.

Chest reward remains.

Chest must no longer influence progression state.

Forbidden

Do not modify chestOpenRequested.

Do not modify chest reward UI.

Do not remove chest entity.

Achievements

- [x] bossRewardPending removed from world

- [x] No reads of bossRewardPending remain

- [x] No writes of bossRewardPending remain

- [x] Floor exit no longer blocked by chest state

Invariants now true

Chest existence cannot block progression.

Stop after completion
Phase 3 — Make Floor Exit Depend Exclusively on Objective Completion
Goal

Floor exit authority is objective completion only.

Implementation

All exit logic must use:

if (hasCompletedAnyObjective(world)) {
advanceToDelveMap()
}

Remove all alternate exit predicates.

Remove any logic depending on:

chest state

reward pending flags

zone trial flags

UI state flags

Valid blockers:

reward UI actively open

transition animation state

Invalid blockers:

chest existence

chest pickup state

reward pending flags

Achievements

- [x] All exit logic uses completion predicate

- [x] No exit logic references chest state

- [x] No exit logic references reward pending flags

Invariants now true

Objective completion fully determines exit eligibility.

Stop after completion
Phase 4 — Make Run Completion Depend Only on Objective Completion
Goal

Final run completion must not depend on chest pickup.

Implementation

Win condition must be:

if (finalFloorObjectiveCompleted) {
completeRun()
}

Remove any requirement for:

bossRewardPending

chest pickup

chestOpenRequested

reward resolution

Chest reward remains optional.

Achievements

- [x] Run completion independent of chest pickup

- [x] Run completion independent of reward pending flags

Invariants now true

Run completion authority is objective completion only.

Stop after completion
Phase 5 — Enforce Ownership Boundaries
Goal

Prevent regression.

Ownership contract

Objective system owns:

objectiveStates

completion state

Exit flow owns:

exit countdown

delve map advancement

Chest system owns:

chest spawn

chest pickup

reward triggering

Chest system must not influence exit flow.

Objective system must not depend on chest system.

Exit flow must not depend on chest system.

Achievements

- [x] No cross-ownership violations

- [x] No alternate completion flags exist

- [x] No chest-based progression gating exists

Final invariants

Completion authority centralized.

Exit authority centralized.

Chest is optional reward only.

Progression deadlocks impossible.

Completion Signal

When all phases complete:

State summary must confirm:

Single objective authority

Single exit authority

No parallel completion flags

No chest-based progression gating

Consistent delve map advancement

Contract complete.
