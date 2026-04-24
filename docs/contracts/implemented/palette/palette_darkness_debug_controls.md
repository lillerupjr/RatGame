# Historical Contract: Palette Darkness Debug Controls

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/settings_overrides_debug_controls.md`
- `docs/canonical/presentation_rendering_pipeline.md`
- `docs/canonical/shadow_lighting_system.md`

## Still-Valid Historical Decisions

- The live palette control surface still centers on `Saturation Weight` and `Darkness`.
- Palette variants are still generated on demand through the existing sprite remap/cache path.
- Palette darkness remains a color-remap brightness control, not a geometry-aware lighting or shadow system.
- The old Value/Lightness palette control is still absent from the live settings model.

## Known Drift / Stale Parts

- The live darkness transform is no longer the simple linear `V * (1 - darkness)` described here; runtime code applies a non-linear darkness curve.
- The contract overstates palette darkness as a scene-night authority. The live full-screen ambient-darkness overlay is driven by `w.lighting` in the shadow/lighting path.
- The current system also includes palette enable/group/id controls and related light override controls that sit outside this contract’s narrow two-control framing.
- The lighting-context section in this contract is historical design framing, not an accurate description of the current shadow/lighting architecture.

## Historical Implementation Notes

- This contract captured the simplification from a broader palette-debug experiment down to the current saturation-plus-darkness control shape.
- Its lasting value is the rule that palette darkness should stay on the color-remap side of the system rather than taking over lighting or shadow ownership.
