# Historical Contract: Quad / Rect Renderer

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/presentation_rendering_pipeline.md`
- `docs/canonical/atlas_render_cache_system.md`

## Still-Valid Historical Decisions

- CPU-side presentation code resolves visibility, atlas/image choice, source rects, and destination geometry before backend submission.
- Render consumers submit prepared pieces only:
  - static-world quads
  - dynamic rect pieces
- Ground chunk rasterization remains separate from atlas ownership.
- Canvas2D and WebGL consume the same prepared-piece contract even when their execution details differ.

## Known Drift / Stale Parts

- The original document cross-links now-dead `docs/contracts/active/...` paths.
- Its family examples predate some current creator-path naming and atlas inventory details.
- The current source of truth is the canonical render and atlas docs, not this contract.

## Historical Implementation Notes

- This contract recorded the point where atlas routing and destination geometry stopped being consumer responsibilities.
- Its lasting value is the “consumers are dumb, CPU decides the renderable piece” rule.
