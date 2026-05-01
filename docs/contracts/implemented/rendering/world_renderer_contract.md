# Historical Contract: WORLD Renderer Contract (V1)

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/presentation_rendering_pipeline.md`

## Still-Valid Historical Decisions

- The live renderer is organized around a three-stage model:
  - `GROUND`
  - `WORLD`
  - `SCREEN/UI`
- Competing world drawables resolve through one ordered `WORLD` stream rather than separate structure or occluder phase authority.
- z-band grouping remains the vertical partition for world output.
- The core sort model is still spatial-first:
  - `slice`
  - `within`
  - `feetSortY`
  - `kindOrder`
  - deterministic tie-breaks

## Known Drift / Stale Parts

- The current comparator includes additional structure south tie-break fields after `kindOrder`.
- `KindOrder.OCCLUDER` still exists as a semantic world kind even though there is no separate occluder pass.
- `KindOrder.LIGHT` is defined as a world kind, but the live renderer does not currently expose a dedicated light-command family matching the old contract wording.
- This document was written as a migration target and includes rollout/validation language that is no longer the right source of truth.

## Historical Implementation Notes

- This contract captured the move away from a phase-split renderer where late structure behavior could override local world ordering.
- Its lasting value is the pass split and the single-world-ordering intent that now lives in the canonical rendering doc.
