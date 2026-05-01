# Settings / Overrides / Debug Controls

## Purpose

Own persisted application settings: player preferences, debug visualization/tooling flags, and system-level runtime overrides, including sanitization, storage, migration, runtime exposure, and editing surfaces.

## Scope

- Bucket schema/modules: `src/settings/settingsTypes.ts`, `userSettings.ts`, `debugToolsSettings.ts`, `systemOverrides.ts`
- Store/migration/reset/update APIs: `src/settings/settingsStore.ts`
- Legacy facades: `src/userSettings.ts`, `src/debugSettings.ts`
- Bootstrap/top-level application: `src/main.ts`
- Editors: `src/ui/settings/settingsPanel.ts`, `src/ui/devTools/devToolsPanel.ts`, `DebugToolsSection.ts`, `SystemOverridesSection.ts`, `src/ui/paletteLab/snapshotViewerPalettePanel.ts`

## Non-scope

- Rendering/lighting/spawn/combat/audio internals beyond settings consumption; see their canonical docs
- World-state persistence outside settings: `docs/canonical/world_state_runtime_data_model.md`
- UI shell architecture: `docs/canonical/ui_shell_menus_runtime_panels.md`
- Gameplay balance intent; this doc covers expression/application of overrides

## Entrypoints

- `src/settings/settingsTypes.ts`
- `src/settings/settingsStore.ts`
- `src/settings/userSettings.ts`
- `src/settings/debugToolsSettings.ts`
- `src/settings/systemOverrides.ts`
- `src/userSettings.ts`
- `src/debugSettings.ts`
- `src/main.ts`
- `src/ui/settings/settingsPanel.ts`
- `src/ui/devTools/devToolsPanel.ts`
- `src/ui/devTools/DebugToolsSection.ts`
- `src/ui/devTools/SystemOverridesSection.ts`
- `src/ui/paletteLab/snapshotViewerPalettePanel.ts`

## Pipeline

1. **Bootstrap**: `main.ts` calls `initUserSettings()`, which delegates to `initSettings()`. The store reads `localStorage["ratgame:settings:v1"]`, migrates/resets, sanitizes all buckets, writes normalized storage, applies audio preferences, and wires settings/dev-tools UI.
2. **Bucket Store**: persisted `AppSettings` has `user`, `debug`, `system`; each bucket has defaults, sanitizer, patch helper. `settingsStore.ts` keeps `currentSettings`; `updateUserSettings(...)`, `updateDebugToolsSettings(...)`, and `updateSystemOverrides(...)` patch one bucket and persist immediately.
3. **Schema**: storage key is `ratgame:settings:v1`; current schema version is `2`. Schema `1` migrates legacy `user.graphics.renderBackend` into debug if needed. Unknown/mismatched versions reset to sanitized defaults.
4. **Bucket Roles**: `user` owns player-facing preferences (mode, health orb side, audio, graphics performance/camera/vertical tiles). `debug` owns diagnostics/visualization (renderer selection, overlays, perf overlay, sun-cycle and heightmap-shadow debug). `system` owns runtime overrides (speed, god/damage/fire-rate, atlas mode, structure cutouts, palette enable/group/id/weights, neutral behavior, hostile spawn tuning).
5. **Legacy Facade**: `src/userSettings.ts` projects buckets into older `debug`, `game`, `render`, `audio` shape. Its `updateUserSettings(...)` translates legacy patches via `splitLegacyPatch(...)`; it is not a second store. `src/debugSettings.ts` supports older debug imports. Legacy `debug.palette*` inputs translate to `system` bucket writes.
6. **Resolvers**: `resolveVerticalTiles(...)` derives effective vertical tiles from mode, viewport class, and stored values. `resolveDebugFlags(...)` combines debug plus selected system inputs. `resolveEffectiveWorldAtlasMode(...)` derives effective atlas mode from requested mode and selected backend.
7. **UI Edit Paths**: `settingsPanel.ts` reads/writes through legacy facade and exposes user-bucket preferences only. `devToolsPanel.ts` writes bucket store directly through `saveDebugToolsSettings(...)`, `saveSystemOverrides(...)`, reset/hard-reset helpers, and dispatches `ratgame:settings-changed`. `SystemOverridesSection.ts` owns palette enable/group/id, `Saturation Weight`, `Darkness`. Snapshot viewer palette panel writes through `updateUserSettings(...)`, validates selection, persists current remap viewer controls, and force-enables palette swap while active.
8. **Runtime Consumption**: `main.ts` consumes audio/dev visibility at startup. Runtime reads direct buckets via `getSettings()` for XP/spawn tuning and legacy `getUserSettings()` for older render/debug/game consumers. HUD perf overlay, palette lab application, and neutral debug actions update settings live.

## Invariants

- The canonical persisted model is three-bucket `AppSettings` in `settingsStore.ts`.
- Persisted settings must be sanitized before live use.
- Persistent backing store is only `localStorage["ratgame:settings:v1"]`.
- Bucket update APIs patch only their own bucket and persist immediately.
- `src/userSettings.ts` / `src/debugSettings.ts` are compatibility facades, not source of truth.
- Defaults, sanitizers, migration, and reset policy live in bucket modules plus store, not consumers.
- Debug defaults are disabled/non-invasive; intended runtime must work with debug off.
- `user.game.userModeEnabled` gates dev-only controls.
- `debug.renderBackend` stores preference; effective renderer depends on runtime WebGL availability.
- `system.worldAtlasMode === "auto"` is not final mode; backend selection participates.
- Palette override authority is `system.paletteSwapEnabled`, `paletteGroup`, `paletteId`, `paletteSWeightPercent`, `paletteDarknessPercent`.
- Live palette controls are `Saturation Weight` and `Darkness`; removed Value/Lightness is not schema.
- `paletteDarknessPercent` is remap brightness, not final ambient darkness or shadow-mask authority.
- Vertical tiles are resolved, not raw-read: manual uses manual value; auto chooses phone/desktop auto value.
- Reset restores sanitized defaults for target bucket; hard reset clears storage and restores all buckets.
- Player settings edit only user bucket; debug/system buckets stay developer-facing.

## Constraints

- New settings require type, default, sanitizer, patch handling if needed, UI editors, and compatibility projection only where required.
- Only `settingsStore.ts` writes localStorage.
- Keep player preferences, debug visualization, and runtime overrides in correct buckets.
- Legacy helpers adapt to bucket authority; they must not redefine truth.
- Runtime/render/gameplay/UI consumers may read or patch settings, but must not own defaults, migration, or persistence.
- Schema changes need explicit `initSettings()` migration/reset behavior.
- Direct bucket-store UI writes must dispatch `ratgame:settings-changed`.
- Normal player surfaces must not expose system overrides.
- Palette remap override fields remain sanitized discrete `PALETTE_REMAP_WEIGHT_OPTIONS` percentages.
- Palette darkness must not substitute for geometry-aware lighting, shadow masks, or final screen darkness; final lighting authority is in `docs/canonical/shadow_lighting_system.md`.

## Dependencies

### Incoming

- Browser `localStorage`
- Palette validation from `src/engine/render/palette/palettes.ts`
- Sun/static-light helpers from `src/shadowSunV1.ts`, `src/shadowSunDayCycle.ts`, `src/staticLightCycle.ts`
- Backend helpers from `src/game/systems/presentation/backend/renderBackendSelection.ts`, `webglSurface.ts`

### Outgoing

- Player settings to `src/main.ts`, audio settings, settings UI
- Debug/render flags to presentation, HUD/debug overlays, dev tools
- System overrides to hostile spawn director, XP progression, rendering overrides, gameplay tuning
- Legacy surfaces to older runtime/UI imports via `src/userSettings.ts`, `src/debugSettings.ts`

## Extension

- Player preference: `user` bucket plus settings panel when exposed
- Visualization/debug flag: `debug` bucket plus `DebugToolsSection`
- Runtime tuning: `system` bucket plus `SystemOverridesSection`
- Compatibility projection only for legacy callers needing `getUserSettings()` shape
- Schema migration when persisted fields move buckets or change meaning

## Failure Modes

- Wrong bucket placement obscures ownership.
- Type-only additions without defaults/sanitizers create unstable runtime state.
- Legacy facade updates without bucket-store updates create translation drift.
- Direct localStorage writes bypass sanitization/migration/reset.
- Missing `ratgame:settings-changed` leaves panels/overlays stale.
- Treating `getUserSettings()` as schema truth is wrong.
- Requested backend/atlas mode may differ from effective runtime mode.
- Field moves without migration misread old persisted data.
- Legacy `debug.palette*` fields do not mean palette values belong to debug bucket.
- Treating `paletteDarknessPercent` as night-darkness authority conflicts with shadow/lighting.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
