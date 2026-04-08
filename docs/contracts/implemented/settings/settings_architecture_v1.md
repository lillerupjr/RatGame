# Historical Contract: Settings Architecture Rewrite (V1)

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/settings_overrides_debug_controls.md`

## Still-Valid Historical Decisions

- The persisted settings model is split into three ownership buckets:
  - `user`
  - `debug`
  - `system`
- `settingsStore.ts` is the persistence boundary for stored settings.
- Defaults and sanitization belong to the bucket modules plus the settings store, not scattered runtime/UI callers.
- Debug-tool booleans default to non-invasive values and must not be required for intended gameplay or presentation.
- Player-facing settings UI, debug tools UI, and system-override UI remain separate ownership surfaces.

## Known Drift / Stale Parts

- The original rewrite framing predates the current compatibility facade in:
  - `src/userSettings.ts`
  - `src/debugSettings.ts`
- The contract's schema-reset language is incomplete for the current implementation:
  - current code performs an explicit schema-`1` migration for `renderBackend`
  - only unsupported schema versions are fully reset
- The live system is now documented canonically and should no longer be rediscovered from this contract.

## Historical Implementation Notes

- This contract captured the move away from a mixed settings object into explicit bucket ownership.
- Its main lasting value is the ownership split:
  - player preferences
  - debug/tooling controls
  - dangerous/internal runtime overrides
