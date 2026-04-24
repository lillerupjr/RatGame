# Historical Contract: Dynamic + Static Atlas

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/atlas_render_cache_system.md`

## Still-Valid Historical Decisions

- The presentation stack uses multiple derived texture domains:
  - `StaticAtlasStore`
  - `DynamicAtlasStore`
  - `SharedWorldAtlasStore`
  - separate ground-chunk raster surfaces
- Effective atlas mode is resolved centrally from requested mode plus backend selection.
- Projected decals remain on the static atlas path even when shared world atlas mode is active.
- Ground chunk rasters remain intentionally separate from atlas page families.
- Atlas misses fall back to direct source images instead of blocking rendering.

## Known Drift / Stale Parts

- The original document cross-links now-dead `docs/contracts/active/...` paths.
- It describes shared world atlas mode as experimental; current canonical docs treat it as a supported mode with explicit constraints.
- Some family examples predate current dynamic inventory details such as boss atlas sources.

## Historical Implementation Notes

- This contract captured the rollout from split atlas families toward backend-aware `shared` vs `dual` routing.
- Its lasting value is the mode-resolution and fallback model that now lives in the canonical atlas/cache doc.
