# Historical Contract: Spawn Director V1 Implementation Contract

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/hostile_ai_spawn_runtime.md`

## Still-Valid Historical Decisions

- The live hostile director still uses continuous budget income, live-threat caps, per-role caps, stockpile caps, burst mode, and abstract spawn requests.
- The anchored `t0` / `t120` / overtime tuning model survived into the implementation.
- The director still excludes boss scheduling, placement logic, adaptive difficulty, and wave scripting.
- Role-first selection and group-size clamping remain the core purchase flow.

## Known Drift / Stale Parts

- The live implementation includes depth-driven heat multipliers and a concrete debug snapshot structure beyond the minimal recommended debug notes here.
- This document was an implementation rollout contract and no longer reflects the exact helper layout, naming, or settings-driven config resolution in code.
- It understates the current separation between hostile pacing state in `world.hostileSpawnDirector` and the derived inspection data in `world.hostileSpawnDebug`.

## Historical Implementation Notes

- This contract captured the first clean implementation target for the hostile director after legacy spawn systems were removed.
- Its lasting value is the anchored pacing model plus the rule that the director should emit requests rather than place enemies directly.
