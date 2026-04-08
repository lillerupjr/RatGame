# Historical Contract: Quad-Native Renderer

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/presentation_rendering_pipeline.md`

## Still-Valid Historical Decisions

- CPU-side structure and visibility systems may still use triangle semantics internally.
- The renderer-facing world-image contract is prepared quad/rect submission, not triangle payload submission.
- Ground, structures, and dynamic sprite families meet at the prepared-piece boundary before backend submission.

## Known Drift / Stale Parts

- The original wording is too absolute about triangles:
  - debug primitives can still carry triangle overlays
  - WebGL batching triangulates prepared quads internally for GPU submission
- The live render-piece split is more specific than this contract implied:
  - static-world quad pieces
  - dynamic rect pieces
  - auxiliary primitive commands

## Historical Implementation Notes

- This contract captured the shift away from triangle-shaped world render payloads.
- Its lasting value is the “CPU semantics may be richer than backend-facing render pieces” rule.
