# Historical Contract: Hue-Locked Palette Remap (V1)

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/presentation_rendering_pipeline.md`
- `docs/canonical/settings_overrides_debug_controls.md`

## Still-Valid Historical Decisions

- The live palette system still resolves one active palette for runtime presentation and keeps palette remap inside the sprite-loading path rather than in a per-frame pass.
- Palette-managed assets still recolor by hue-locking against palette-derived HSV anchors using circular hue distance.
- The loader/cache/prewarm seam survived: remap happens at load time, cached sprite variants are reused later, and alpha is preserved.
- Low-saturation pixels still participate in hue remap; there is no neutral-lane exemption in the live path.

## Known Drift / Stale Parts

- The live cache key is no longer palette-id-only; it is variant-keyed by palette id plus saturation weight and darkness.
- The live remap no longer preserves original `S` and `V` unconditionally:
  - saturation blends toward the selected palette anchor by `sWeight`
  - darkness applies a final brightness reduction
- The contract framed darkness and additional weight controls as out of scope for V1, but they are now part of the live runtime palette path.
- This document was a draft migration contract and is no longer the authoritative description of the implemented palette model.

## Historical Implementation Notes

- This contract captured the move away from discrete RGB nearest-color palette replacement toward hue-locked palette families.
- Its lasting value is the hue-lock direction and loader-time remap seam that now live in the canonical presentation/settings docs.
