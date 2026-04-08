# Settings / Overrides / Debug Controls

## Purpose

- Own the persisted application settings model: player-facing preferences, debug visualization/tooling flags, and system-level runtime overrides.
- Define how settings are sanitized, stored, migrated, exposed to runtime code, and edited through the settings and dev-tools UI surfaces.

## Scope

- The canonical bucketed settings schema in:
  - `src/settings/settingsTypes.ts`
  - `src/settings/userSettings.ts`
  - `src/settings/debugToolsSettings.ts`
  - `src/settings/systemOverrides.ts`
- Persistent settings storage, migration, reset, and bucket update APIs in:
  - `src/settings/settingsStore.ts`
- The legacy compatibility facade used by much of the runtime in:
  - `src/userSettings.ts`
  - `src/debugSettings.ts`
- Bootstrap initialization and top-level settings application in:
  - `src/main.ts`
- Primary UI editing surfaces for settings buckets in:
  - `src/ui/settings/settingsPanel.ts`
  - `src/ui/devTools/devToolsPanel.ts`
  - `src/ui/devTools/DebugToolsSection.ts`
  - `src/ui/devTools/SystemOverridesSection.ts`
  - `src/ui/paletteLab/snapshotViewerPalettePanel.ts`

## Non-scope

- Rendering, lighting, spawn, combat, or audio system internals beyond their role as settings consumers
- World-state persistence outside the settings store
- Canonical architecture for the UI shell itself; this doc only covers settings ownership and edit flow
- Gameplay balancing intent; this doc only covers how runtime overrides are expressed and applied

## Key Entrypoints

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

## Data Flow / Pipeline

1. **Bootstrap Initialization**
   - `main.ts` calls `initUserSettings()`.
   - `initUserSettings()` delegates to `initSettings()` in `settingsStore.ts`.
   - `initSettings()`:
     - reads `localStorage["ratgame:settings:v1"]`
     - handles schema migration/reset
     - sanitizes all buckets
     - writes the normalized result back to storage
   - `main.ts` then immediately applies persisted audio preferences and wires the settings/dev-tools UI.

2. **Canonical Bucketed Store**
   - The authoritative persisted shape is `AppSettings`:
     - `user`
     - `debug`
     - `system`
   - Each bucket has:
     - a default object
     - a sanitizer
     - a patch helper
   - `settingsStore.ts` keeps the live in-memory settings object in `currentSettings`.
   - Bucket update APIs:
     - `updateUserSettings(...)`
     - `updateDebugToolsSettings(...)`
     - `updateSystemOverrides(...)`
   - Every update persists immediately to local storage.

3. **Schema / Migration Contract**
   - The storage key is fixed at `ratgame:settings:v1`.
   - The current schema version is `2`.
   - On schema `1`, the store migrates legacy `user.graphics.renderBackend` into the debug bucket if needed.
   - Unknown or mismatched schema versions are reset to sanitized defaults rather than partially trusted.

4. **Bucket Responsibilities**
   - `user` owns player-facing preferences:
     - user mode
     - health-orb side
     - audio volumes/mutes
     - graphics preferences such as performance mode, camera smoothing, and vertical-tile preferences
   - `debug` owns diagnostics and visualization controls:
     - renderer selection
     - overlays
     - perf overlay selection
     - sun-cycle debug controls
     - heightmap shadow debug controls
   - `system` owns runtime tuning and override behavior:
     - game speed
     - god mode / damage / fire-rate multipliers
     - rendering overrides such as atlas mode and structure cutout parameters
     - palette override enablement, group/id selection, and palette remap weights
     - neutral bird behavior overrides
     - hostile spawn tuning

5. **Legacy Compatibility Facade**
   - Much of the runtime still reads and writes settings through `src/userSettings.ts`.
   - `getUserSettings()` projects the bucketed store into an older composite shape:
     - `debug`
     - `game`
     - `render`
     - `audio`
   - `updateUserSettings(...)` in `src/userSettings.ts` is not a second store; it translates a legacy patch into bucket-specific patches via `splitLegacyPatch(...)`.
   - `src/debugSettings.ts` is a companion compatibility surface for older debug-setting imports and helper access.
   - Legacy debug-shaped palette fields such as `debug.paletteSWeightPercent` and `debug.paletteDarknessPercent` are compatibility inputs only; they are translated back into `system` bucket writes.

6. **Resolution Helpers**
   - `resolveVerticalTiles(...)` in `src/settings/userSettings.ts` resolves effective visible vertical tiles from:
     - mode (`auto` / `manual`)
     - viewport classification (`phone` / `desktop`)
     - stored manual/auto values
   - `resolveDebugFlags(...)` in `src/settings/debugToolsSettings.ts` combines the debug bucket with selected system-override inputs to produce render/debug flag outputs.
   - `resolveEffectiveWorldAtlasMode(...)` in `src/settings/systemOverrides.ts` turns requested atlas mode plus selected backend into the effective atlas mode.

7. **UI Edit Paths**
   - `settingsPanel.ts` is the player-facing settings UI.
   - It reads through the legacy facade and writes through `updateUserSettings(...)` from `src/userSettings.ts`.
   - Normal player settings surfaces do not expose system overrides.
   - `devToolsPanel.ts` is the developer-facing settings editor.
   - It writes directly to the bucketed store through:
     - `saveDebugToolsSettings(...)`
     - `saveSystemOverrides(...)`
     - reset / hard-reset helpers
   - `SystemOverridesSection.ts` owns the live palette override controls:
     - palette enablement
     - palette group/id selection
     - `Saturation Weight`
     - `Darkness`
   - Dev-tools UI emits the `ratgame:settings-changed` window event after store writes so dependent UI can resync.
   - `snapshotViewerPalettePanel.ts` is a specialized palette/light control surface used during palette snapshot viewing.
   - It writes through `updateUserSettings(...)`, keeps palette selection valid for the selected group, persists only the current palette-remap viewer controls, and force-enables palette swap while the viewer is active.

8. **Runtime Consumption**
   - `main.ts` consumes settings at startup for:
     - audio mute/volume setup
     - dev-tools visibility wiring
   - Runtime systems read settings through both access layers:
     - direct bucket reads from `getSettings()` for things like XP and hostile-spawn tuning
     - legacy reads from `getUserSettings()` for older render/debug/game consumers
   - Some UI/runtime actions update settings live:
     - HUD perf overlay selection
     - palette-lab palette application
     - neutral bird debug actions

## Core Invariants

- The canonical persisted settings model is the three-bucket `AppSettings` object in `settingsStore.ts`.
- All persisted settings must pass through sanitizer functions before becoming live runtime state.
- The only persistent backing store is `localStorage` under `ratgame:settings:v1`.
- Bucket update APIs patch only their own bucket and persist immediately.
- `src/userSettings.ts` is a compatibility facade over the bucketed store, not a separate source of truth.
- Debug-tool booleans default to disabled/non-invasive values; intended gameplay and presentation must remain valid with debug tooling off.
- Defaults, sanitization, migration, and reset policy live in the bucket modules plus `settingsStore.ts`, not in runtime/render/UI consumers.
- `user.game.userModeEnabled` is the authoritative flag for hiding dev-only controls in normal play.
- `debug.renderBackend` is the stored renderer preference; effective rendering behavior may still depend on runtime WebGL availability.
- `system.worldAtlasMode === "auto"` is not itself the final mode; the effective atlas mode depends on the selected backend.
- `system.paletteSwapEnabled`, `system.paletteGroup`, `system.paletteId`, `system.paletteSWeightPercent`, and `system.paletteDarknessPercent` are the authoritative persisted palette override fields, even when compatibility APIs expose some of them under debug-shaped names.
- The live palette remap weight controls are `Saturation Weight` and `Darkness`; the removed Value/Lightness control is not part of the current settings schema.
- `paletteDarknessPercent` is a palette-remap brightness control, not the final ambient-darkness or shadow-mask authority.
- Vertical tile count is resolved, not read raw:
  - `manual` uses the user-set manual value
  - `auto` selects phone/desktop auto values based on viewport classification
- Reset helpers restore sanitized defaults for the targeted bucket; hard reset restores sanitized defaults for all buckets and clears storage first.
- Player-facing settings surfaces edit user-bucket preferences only; debug and system buckets remain on developer-facing paths.

## Design Constraints

- New settings must be added through the bucketed settings system:
  - extend the type
  - add a default value
  - add sanitization
  - add patch handling if needed
  - update UI editors and compatibility projections only where required
- Do not write settings directly to `localStorage` outside `settingsStore.ts`.
- Keep player preferences, debug visualization flags, and runtime behavior overrides in their correct buckets. Do not collapse them into a single catch-all patch path.
- The bucketed store remains the authority. Legacy helpers in `src/userSettings.ts` and `src/debugSettings.ts` must adapt to it rather than redefining settings truth.
- Debug-only visualization and tuning controls must remain optional. Intended gameplay and presentation cannot depend on debug toggles being enabled.
- Runtime, rendering, gameplay, and UI modules may consume settings or emit patches, but they must not own settings defaults, migration policy, or persistence behavior.
- Schema changes must be handled explicitly in `initSettings()`. Silent partial reuse of unknown stored shapes is drift.
- UI code that writes directly to `settingsStore.ts` must continue to dispatch the repo’s settings-changed event so dependent panels and overlays stay in sync.
- Normal player settings surfaces must not expose system overrides; dangerous/internal switches stay in dev-tools-only editors.
- Palette remap override fields must remain sanitized discrete percentages from `PALETTE_REMAP_WEIGHT_OPTIONS`; callers must not treat them as arbitrary floats in storage.
- Palette darkness must remain a color-remap control, not a substitute for geometry-aware lighting, shadow masks, or the final screen-darkness overlay.

## Dependencies (In/Out)

### Incoming

- Browser `localStorage`
- Palette-group validation and lookup from `src/engine/render/palette/palettes.ts`
- Sun-cycle and static-light clamp helpers from:
  - `src/shadowSunV1.ts`
  - `src/shadowSunDayCycle.ts`
  - `src/staticLightCycle.ts`
- Renderer/backend state helpers from:
  - `src/game/systems/presentation/backend/renderBackendSelection.ts`
  - `src/game/systems/presentation/backend/webglSurface.ts`

### Outgoing

- Player-facing settings used by:
  - `src/main.ts`
  - `src/game/audio/audioSettings.ts`
  - settings UI
- Debug and render flags used by:
  - presentation systems
  - HUD/debug overlays
  - dev tools
- System overrides used by:
  - hostile spawn director
  - XP progression
  - rendering override paths
  - gameplay tuning hooks
- Compatibility settings surfaces used broadly by older runtime/UI imports via:
  - `src/userSettings.ts`
  - `src/debugSettings.ts`

## Extension Points

- Add a new player-facing preference by extending the `user` bucket and the settings panel if it needs direct UI exposure.
- Add a new visualization/debug flag by extending the `debug` bucket and `DebugToolsSection`.
- Add a new runtime tuning control by extending the `system` bucket and `SystemOverridesSection`.
- Add a new compatibility projection only when an existing legacy caller still needs the older `getUserSettings()` shape.
- Add a schema migration in `initSettings()` when a persisted field moves buckets or changes meaning.

## Failure Modes / Common Mistakes

- Writing a new setting into the wrong bucket makes ownership unclear and breaks the bucket model.
- Adding a setting to a type without updating defaults and sanitization leads to unstable runtime state.
- Updating the legacy facade in `src/userSettings.ts` without updating the canonical bucket store creates translation drift.
- Writing directly to `localStorage` bypasses sanitization, migration, and reset behavior.
- Forgetting to dispatch `ratgame:settings-changed` after direct bucket-store writes leaves UI panels and overlays stale.
- Treating `getUserSettings()` as the canonical schema is incorrect; it is a compatibility projection.
- Assuming requested backend or atlas mode is always the effective runtime mode is incorrect; backend availability and auto-resolution still apply.
- Forgetting the schema migration/reset path when moving fields between buckets causes old persisted data to be misread.
- Treating legacy `debug.palette*` compatibility fields as proof those values belong to the debug bucket is incorrect; they persist in system overrides.
- Treating `paletteDarknessPercent` as the repo’s authoritative night-darkness system is incorrect; final ambient darkness is owned by the shadow/lighting path.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
