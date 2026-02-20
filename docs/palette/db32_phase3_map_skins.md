# DB32 Phase 3 — MapSkin Palettes + Dev Override

Phase 3 makes runtime palette selection map-skin aware, with a dev override for testing.

## Palette priority

Runtime map sprite palette is resolved in this order:

1. Dev override (if enabled)
2. Active map skin `paletteId`
3. `db32`

This is centralized in:

- `src/game/render/activePalette.ts`

## Setting a palette on a skin

Map skin type supports:

- `paletteId?: "db32" | "divination"`

Defined in:

- `src/game/content/mapSkins.ts`

Example:

- `building1` (Avenue assets) sets `paletteId: "divination"`.

Skins without a palette id fall back to `db32`.

## Prewarm behavior

Floor transition prewarm resolves palette with the same resolver used by sprite loading, then prewarms that palette's runtime sprites.

This keeps transition prewarm and runtime cache behavior aligned.

## Dev override usage

In the dev Render section:

- `Palette Override` checkbox enables/disables settings override.
- `paletteId` dropdown picks override palette.

With override off, map-skin palette applies.  
With override on, selected palette is forced globally for runtime map sprites.
