# Historical Contract: Spawn Director V1 Tuning Anchors

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/hostile_ai_spawn_runtime.md`

## Still-Valid Historical Decisions

- The live hostile director still uses anchored pacing for both:
  - budget income (`powerPerSec`)
  - live threat cap
- The `t0` / `t120` / overtime-slope model survived:
  - `0..120s` linear interpolation
  - `120s+` linear continuation
- Enemy `spawn.power` still uses the minion baseline as the director’s threat-budget unit.

## Known Drift / Stale Parts

- The live implementation multiplies these base anchors by depth-driven heat factors from current system settings.
- This document is tuning intent, not a full description of the runtime config-resolution path or how the debug snapshot is built.
- Some feel-language and playtest guidance here is historical tuning context rather than enforceable architecture.

## Historical Implementation Notes

- This contract captured the simple anchored pacing model that replaced heavier authored curve expectations.
- Its lasting value is the explicit anchor-based progression shape now documented in the hostile runtime canon.
