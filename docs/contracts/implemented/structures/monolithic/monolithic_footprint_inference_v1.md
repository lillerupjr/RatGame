# Historical Contract: Monolithic Footprint Inference (V1)

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/structure_geometry_slicing_system.md`

## Still-Valid Historical Decisions

- Monolithic footprint dimensions should come from semantic sprite analysis rather than full-silhouette bbox width/height.
- Anchor-centered slicing and admitted triangle evidence remain the right evidence class for semantic footprint derivation.
- Overhangs and non-footprint visual spread should not become logical footprint by default.

## Known Drift / Stale Parts

- The exact staged algorithm in this contract is not the live implementation.
- Current code derives the footprint through guide-aligned admitted-triangle counting (`footprintLeftCount` / `footprintRightCount`) rather than this contract's exact bottom-band procedure and tolerance rules.
- The implementation still allows semantic fallback geometry when computed geometry is unavailable.

## Historical Implementation Notes

- This contract helped move footprint reasoning away from raw sprite extents.
- Its lasting value is the rule that semantic footprint must be derived from admitted support evidence, not the widest visible silhouette.
