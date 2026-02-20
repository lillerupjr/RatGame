# DB32 Phase 2 — Palette Prewarm on Floor Transition

Phase 2 adds palette prewarm to reduce first-frame hitching when entering a new floor with runtime palette swap enabled.

## What prewarm does

- Uses the existing in-memory runtime sprite cache.
- Triggers sprite loads/remaps ahead of gameplay for a target palette.
- Waits in a bounded loop for readiness so transitions cannot hang indefinitely.

## How sprite ids are chosen

`collectRuntimeSpriteIdsToPrewarm` reads the active compiled map and builds a conservative list from fields that commonly hold runtime sprite ids:

- `decals`
- `overlays`
- `structures`
- `renderPieces`

This keeps prewarm useful without scanning every possible asset source.

## Where prewarm is called

Prewarm runs in `enterFloor` after the next map is activated and before gameplay returns to `FLOOR` run state:

- If palette swap is enabled and palette is not `db32`, collect ids and prewarm that palette.
- If palette swap is disabled (or `db32`), prewarm is skipped.

Map selection click handlers now await `enterFloor`, so the cost is paid while transitioning.

## Bounded wait behavior

`prewarmPaletteSprites(paletteId, spriteIds)` waits until all requested sprites are ready, or until a hard timeout (`MAX_WAIT_MS = 1500`) is reached.

This guarantees a deterministic upper bound even if some sprites fail to load.

## Expanding later

If needed, increase coverage by extending id collection with:

- explicit floor family/runtime top ids in use
- structure pack manifests
- zone-specific prewarm manifests
