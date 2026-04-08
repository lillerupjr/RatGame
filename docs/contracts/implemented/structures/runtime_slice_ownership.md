# Historical Contract: Runtime Slice Ownership

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/structure_geometry_slicing_system.md`

## Still-Valid Historical Decisions

- Runtime structure ownership and render ordering are derived from footprint-relative parent-tile ownership, not from visual anchor center or raw triangle order.
- Render key derivation for runtime-sliced structures ultimately resolves from parent tile fields:
  - `slice = parentTx + parentTy`
  - `within = parentTx`
- Ownership math should live in one shared helper path rather than being duplicated across runtime and debug code.

## Known Drift / Stale Parts

- The live helper is `resolveMonolithicSliceParentFootprintPosition()` / `resolveMonolithicSliceParentTileFromSeAnchor()`, not the exact `getStructureBandOwnerTile(...)` contract proposed here.
- The current implementation does not use the contract's `bandCount = w + h` / single SE-duplicate rule; band handling includes clamped outer corner bands and a different boundary progression.
- The broad ownership intent survived, but the exact algorithm in this contract did not become the live implementation.

## Historical Implementation Notes

- This contract captured the shift away from center-anchor-based slice ownership.
- Its lasting value is the rule that ownership and sort keys must come from explicit footprint tile ownership.
