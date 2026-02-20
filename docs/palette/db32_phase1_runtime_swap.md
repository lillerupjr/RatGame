# DB32 Phase 1 — Runtime Palette Swap (Opt-In)

Phase 1 adds runtime palette swapping for canonical DB32 runtime map sprites.

## What Phase 1 does

- Keeps DB32 canonical sprites as the runtime source.
- Adds an opt-in palette swap at sprite load time (not per frame).
- Caches loaded results by `(spriteId, paletteId)` so revisits reuse the converted asset.

## Palette used

Divination (Lospec), 7 colors:

- `#001c40`
- `#1e2a5f`
- `#235662`
- `#5464cf`
- `#cb8bf0`
- `#75d7da`
- `#9effb8`

Runtime remap logic computes nearest target color from DB32 using RGB squared distance.

## Toggle controls

In the DEV settings panel under `Render`:

- `paletteSwapEnabled` checkbox
- `paletteId` select (`db32`, `divination`)

Keyboard shortcut:

- `F5` cycles:
1. disabled -> enabled + `divination`
2. enabled + `divination` -> enabled + `db32`
3. enabled + `db32` -> disabled

## Caching behavior

- Cache key includes both sprite id and effective palette mode.
- When swap is disabled (or `paletteId = db32`), canonical DB32 image cache is used.
- When swap is enabled with `divination`, the swapped image is generated once on load and cached.

## Known behavior

- Divination has 7 colors, so many DB32 midtones collapse into fewer bands.
- This is expected and part of the look for this palette.
