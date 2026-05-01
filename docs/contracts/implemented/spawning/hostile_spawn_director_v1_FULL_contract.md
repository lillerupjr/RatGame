# Historical Contract: Hostile Spawn Director V1 Full Contract

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/hostile_ai_spawn_runtime.md`

## Still-Valid Historical Decisions

- The live hostile spawn architecture is still split into:
  - pacing/request generation
  - separate request execution/placement
- The procedural constraints survived:
  - no boss scheduling in the hostile director
  - no neutral-mob mixing
  - no wave-scripted pools
  - no adaptive difficulty layer
- Role-first selection, group purchases, budget clamps, burst mode, and abstract request output all remain live architecture.

## Known Drift / Stale Parts

- The contract is an exact implementation brief and no longer reflects the current source layout or the final debug snapshot shape.
- The live director also applies depth-driven heat scaling and settings-driven config overrides, which this rollout brief does not fully frame as part of the runtime model.
- Some “do not reintroduce legacy X” language here is now purely historical implementation guidance rather than present system truth.

## Historical Implementation Notes

- This contract captured the clean-room hostile spawn implementation after earlier spawn approaches were removed.
- Its lasting value is the hard boundary between abstract pacing logic and concrete spawn placement/execution.
