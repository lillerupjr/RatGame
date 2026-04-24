# Historical Contract: Computed Monolithic Building Basis (V2)

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/structure_geometry_slicing_system.md`
- `docs/canonical/map_compilation_activation_floor_topology.md`

## Still-Valid Historical Decisions

- Canonical monolithic building skins are authored as identity plus sprite path rather than public authored footprint metadata.
- A shared semantic basis is reused across placement, footprint resolution, slicing, and triangle-cache generation.
- Compile-time monolithic building placement resolves geometry through the semantic prepass layer rather than reading legacy authored `w` / `h` directly from building skins.

## Known Drift / Stale Parts

- The live system still supports semantic placement fallback records for skins/sprites whose computed geometry is unavailable in the current environment.
- The current implementation computes more specific anchor, footprint, and slice-entry data than this contract's higher-level description captured.
- This contract describes the direction of the architecture well, but it is no longer the right place to discover the exact live rules.

## Historical Implementation Notes

- This contract captured the move to a single computed basis for monolithic buildings.
- Its lasting value is the “one shared semantic basis, not per-subsystem geometry truths” rule.
