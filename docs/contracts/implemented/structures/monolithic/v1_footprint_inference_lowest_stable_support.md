# Historical Contract: Lowest Stable Support Footprint Inference (V1)

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/structure_geometry_slicing_system.md`

## Still-Valid Historical Decisions

- Logical footprint should represent grounded/base support semantics rather than full projected silhouette.
- Padding, rooftop spread, terraces, balconies, and other overflow should not automatically widen logical footprint.
- The intent of footprint inference is semantic support, not maximum visible sprite span.

## Known Drift / Stale Parts

- The current implementation does not run the exact bottom-up “lowest stable support region” algorithm described here.
- Live code instead combines south-profile anchor derivation with guide-aligned admitted-triangle footprint evidence.
- This document is still useful as design intent, but not as the live algorithm.

## Historical Implementation Notes

- This contract captured the anti-silhouette-inflation principle behind monolithic footprint work.
- Its lasting value is the separation between semantic footprint and visual overflow.
