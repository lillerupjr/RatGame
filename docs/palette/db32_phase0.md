# DB32 Phase 0 — Canonical Runtime Sprite Proof

Phase 0 establishes a canonical DB32-normalized copy of a subset of runtime map sprites.

## What is affected

Only runtime map sprites loaded from `public/assets-runtime` via:

- `src/engine/render/sprites/renderSprites.ts`

This includes sprite ids that start with:

- `tiles/`
- `structures/`
- `props/`

Character sprites (player/enemy/vendor) are not changed in Phase 0.

## Output folder

The DB32-normalized sprites are generated into:

- `public/assets-runtime/base_db32/...`

The directory layout mirrors the original `public/assets-runtime/...`.

## Generate DB32 subset

```bash
npm run assets:db32
```

The script prints:

- total files processed
- total pixels mapped
- time spent

## Runtime loader switch

`renderSprites.resolveUrl()` points `tiles/`, `structures/`, `props/` to:

- `/assets-runtime/base_db32/${id}.png`

This is only a proof step to validate visuals and ensure nothing is missing.

## Expanding coverage

Phase 0 intentionally normalizes a subset folder list inside:

- `tools/palette/normalize_db32.mjs`

When visuals look acceptable, expand `SUBSET_DIRS` to cover more runtime sprites.
