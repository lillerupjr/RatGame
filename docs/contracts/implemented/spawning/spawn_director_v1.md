# Historical Contract: Spawn Director V1 Design

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/hostile_ai_spawn_runtime.md`

## Still-Valid Historical Decisions

- The live hostile director is still a procedural pacing system built around budget income, live-threat caps, role-first selection, group purchases, and burst mode.
- The director still owns `what / when / how many`, while placement is handled by a separate execution layer.
- Validity still depends on canonical enemy spawn metadata such as unlock gates, `maxAlive`, role caps, and purchase affordability.
- Bosses and neutral monsters remain excluded from the procedural hostile pool.

## Known Drift / Stale Parts

- The live implementation is now specifically the hostile spawn director and includes concrete world-owned state, debug snapshot output, and floor-heat scaling from depth.
- The current director uses anchored `t0` / `t120` / overtime curves plus runtime settings overrides rather than the more generic design-language curve model here.
- This document predates the implemented helper structure and now over-functions as a design summary rather than a precise source of system truth.

## Historical Implementation Notes

- This contract captured the spawn architecture split that survived into the live hostile runtime:
  - pacing/request generation
  - separate concrete placement/execution
- Its lasting value is the role-first pacing model and the separation between abstract spawn requests and real spawn placement.
