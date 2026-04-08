# Historical Contract: Palette Snapshot System + Main Menu Palette Lab

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/ui_shell_menus_runtime_panels.md`
- `docs/canonical/settings_overrides_debug_controls.md`

## Still-Valid Historical Decisions

- Palette snapshots are visual-scene reproduction artifacts, not gameplay saves.
- Snapshot payloads are intentionally minimal:
  - metadata
  - scene context
  - camera state
  - visual world state
  - thumbnail
- Snapshot artifacts are stored in IndexedDB, not `localStorage`.
- Snapshot storage is capped at `50` records and does not auto-overwrite or auto-delete.
- Palette Lab owns browse/open/rename/delete flows for saved snapshots.
- Snapshot viewer controls apply palette/light changes immediately through persisted settings and force `paletteSwapEnabled` while active.
- Closing snapshot viewer returns the user to the Palette Lab flow.

## Known Drift / Stale Parts

- This contract describes snapshot viewing as a paused simulation mode.
- Current code instead runs the viewer through normal runtime shell flow using:
  - `world.paletteSnapshotViewerActive`
  - `main.ts` shell visibility sync
  - a snapshot-viewer palette panel mounted from the UI shell
- Some original wording was broad design intent rather than the exact live implementation and is now represented more accurately in canonical docs.

## Historical Implementation Notes

- Snapshot capture starts from the pause menu.
- The saved artifact includes a generated thumbnail and a versioned record shape.
- Missing-map snapshot opens fail through surfaced UI error handling instead of silent fallback.
