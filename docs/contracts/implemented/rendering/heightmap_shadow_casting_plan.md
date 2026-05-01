# Historical Contract: Heightmap Shadow Casting Plan

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/shadow_lighting_system.md`

## Still-Valid Historical Decisions

- The live shadow path still uses a screen-space scene-height buffer plus CPU ray march to build per-pixel structure shadow masks.
- Heightmap grayscale values are still treated as normalized height data and written into a shared max-blended height buffer.
- The rendered color sprite alpha remains the authoritative silhouette mask for height-buffer occupancy.
- The shadow mask still depends on sun direction and elevation plus explicit ray-march tuning parameters.

## Known Drift / Stale Parts

- The live system does not assume universal heightmap support; support is manifest-gated and currently only enabled for `structures/buildings/batch1/`.
- The current implementation is explicitly cached by map, sun step, camera, viewport, and ray-march parameters, which this plan only described loosely.
- GPU-first, soft-shadow, and generalized future-rollout ideas in the plan are not current architectural requirements.
- The live output path enqueues the mask as an auxiliary world primitive and renders it through the Canvas2D auxiliary renderer.

## Historical Implementation Notes

- This contract captured the shift from coarse shadow ideas toward the current per-pixel heightmap shadow approach.
- Its lasting value is the height-buffer plus ray-march model that now lives in the canonical shadow/lighting doc.
