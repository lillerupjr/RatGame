# UI Shell / Menus / Runtime Panels

## Purpose

Own the DOM-facing shell around the runtime: static element lookup, menu choreography, pause/runtime overlay controllers, touch/dialog/reward/vendor surfaces, and callback boundaries that present but do not own gameplay state.

## Scope

- Static refs: `src/ui/domRefs.ts`
- Menus/local menu state: `src/ui/menuWiring.ts`
- Pause overlay: `src/ui/pause/pauseMenu.ts`
- Runtime panels/controllers: `src/ui/rewards/relicRewardMenu.ts`, `vendor/vendorShopMenu.ts`, `dialog/renderDialogChoices.ts`, `mobile/mobileControls.ts`, `paletteLab/snapshotViewerPalettePanel.ts`, `interaction/tapSafeActivate.ts`
- Top-level shell bootstrap/visibility: `src/main.ts`
- Runtime UI mounting/DOM updates: `src/game/game.ts`

## Non-scope

- Settings storage/debug/system override ownership: `docs/canonical/settings_overrides_debug_controls.md`
- World rendering/canvas pipelines: `docs/canonical/presentation_rendering_pipeline.md`
- Reward/vendor/objective/route/dialog gameplay semantics: `docs/canonical/progression_objectives_rewards.md`
- Database/leaderboard behavior beyond UI consumption: `docs/canonical/database.md`

## Entrypoints

- `src/ui/domRefs.ts`
- `src/ui/menuWiring.ts`
- `src/ui/pause/pauseMenu.ts`
- `src/ui/rewards/relicRewardMenu.ts`
- `src/ui/vendor/vendorShopMenu.ts`
- `src/ui/dialog/renderDialogChoices.ts`
- `src/ui/mobile/mobileControls.ts`
- `src/ui/paletteLab/snapshotViewerPalettePanel.ts`
- `src/ui/interaction/tapSafeActivate.ts`
- `src/main.ts`
- `src/game/game.ts`

## Pipeline

1. **DOM Refs**: `getDomRefs()` is the typed lookup boundary for static `index.html`; missing required elements throw. It builds grouped HUD/map/end/dialog refs and inserts the HUD perf-overlay `<select>`.
2. **Bootstrap / Wiring**: `main.ts` initializes settings, creates game runtime, mounts settings/dev tools/pause/snapshot viewer panels, then calls `wireMenus(refs, gameApi)`. Menu shell uses injected callbacks, not direct world mutation.
3. **Visibility**: `syncUiForAppState(...)` coordinates boot/loading, menu screens, pause, HUD, route map, end screen, dialog/reward/vendor overlays. In `RUN`, blocking overlays gate HUD/mobile controls. In `MENU`, exactly the active menu screen stays visible, defaulting to welcome.
4. **Menus**: `wireMenus(...)` owns selected character/map, pending start mode, starter modal, palette-lab snapshot card rendering. Palette Lab lists IndexedDB snapshots, renders card metadata, renames/deletes records, and opens snapshots through runtime callback. Menu actions use `GameApi`: `previewMap(...)`, starts, `openPaletteSnapshot(...)`. User mode hides dev-only affordances. `bindActivate(...)` suppresses duplicate touch/click activation.
5. **Pause**: `mountPauseMenu(...)` preserves root children, hides them while active, restores on close. It owns section switching, quit confirmation, debug relic editor visibility, read-only build/debug stat views, and embedded settings panel. Palette snapshot capture starts here: `pauseMenu.ts` creates visual-only draft; `main.ts` thumbnails/persists from active render canvas. Pause uses callbacks (`onResume`, `onQuitRun`, `onOpenDevTools`, `onSavePaletteSnapshot`) for runtime changes.
6. **Runtime Overlays**: `game.ts` mounts reward/vendor overlays into body roots. Controllers render from state and callbacks; `game.ts` remains authority for choosing relics, purchases, leaving vendor, and advancement. `renderDialogChoices(...)` renders dialog model from `game.ts`.
7. **Dialog / Interaction**: `game.ts` owns `activeDialog`, writes dialog text/choices and HUD interaction prompt from run state, dialog, vendor state, nearby interactables, and phone controls. Opening vendor clears dialog; reward pipeline closes dialog/vendor before reward UI.
8. **Mobile Controls**: `createMobileControls(...)` owns virtual stick/interact DOM and emits `onMove(x,y,active)` / `onInteractDown(down)`. `game.ts` adapts to virtual sim input; `main.ts` decides enablement from run state and blocking overlays.
9. **Map / End / Snapshot Viewer**: `game.ts` updates HUD, route map, end stats, and leaderboard tabs. Route clicks use DOM dataset payloads to queue floor-load intents. End buttons call retry/quit. `main.ts` controls snapshot-viewer panel visibility; `game.ts` opens records and rerolls seed. Viewer shows only during `RUN` + `PLAYING` with `paletteSnapshotViewerActive`, closes to Palette Lab, rerolls through `game.ts`, and writes palette/light controls through settings facade.

## Invariants

- `getDomRefs()` is the only static DOM lookup boundary.
- `main.ts` owns top-level visibility for `BOOT`, `LOADING`, `MENU`, `RUN`.
- `menuWiring.ts` talks to runtime only through `GameApi`.
- Runtime overlays (`reward`, `vendor`, `dialog`, `pause`, `snapshot viewer`) render from state + callbacks and do not own gameplay state.
- Blocking overlays gate phone controls; mobile controls enable only in active run play with no blocker.
- `pauseMenu.ts` preserves/restores host children.
- Route/end interactions depend on explicit DOM payload/button contracts handled in `game.ts`.
- Touch-facing overlays use tap-safe activation where duplicate clicks are possible.
- Settings visibility may depend on user mode; settings truth stays in settings system.
- Palette snapshots are local visual-scene artifacts, not saves, run persistence, progression, or inventory.
- Palette Lab storage failures must surface through shell.
- Closing snapshot viewer returns to Palette Lab menu.

## Constraints

- New static shell elements go through `domRefs.ts`.
- New UI surfaces should accept state/callbacks, render DOM, and return intent; they must not mutate world directly.
- High-level visibility stays in `main.ts` app-state sync.
- New blocking overlays must join mobile-control/HUD gating.
- Settings/progression/vendor/reward/gameplay semantics stay in owning systems; shell only presents.
- Touch overlays/menus use pointer/tap-safe helpers when duplicate click risk exists.
- Palette snapshots remain visual-only local artifacts; do not move them to `localStorage`, auto-overwrite/delete, or expand to save/load.
- Snapshot viewer palette/light controls route through settings, not render-only state.

## Dependencies

### Incoming

- Static HTML from `index.html`
- App/run state from `main.ts`
- Game callbacks/world snapshots from `src/game/game.ts`
- User mode/settings reads from `src/userSettings.ts` and embedded settings/dev controllers
- Palette snapshot storage/actions from `src/game/paletteLab/snapshotStorage.ts`

### Outgoing

- Start/preview/open actions via `GameApi`
- Pause actions to `main.ts`
- Mobile virtual input to sim input
- Reward/vendor/dialog callbacks to `game.ts`
- Visibility state affecting HUD, touch controls, app-state presentation

## Extension

- Static screen: DOM refs, `main.ts` visibility, `menuWiring.ts` or dedicated controller
- Runtime overlay: mount/render controller fed by `game.ts` state/callbacks
- Pause section: `PauseSectionId`, nav/buttons, panel rendering
- Route-map interaction: explicit DOM dataset payloads interpreted by `game.ts`
- Snapshot-viewer/palette-lab control: mount controller from `main.ts`

## Failure Modes

- Direct world mutation from `menuWiring.ts` creates shell/runtime coupling.
- New DOM ids without `domRefs.ts` cause lookup failures or hidden-state drift.
- Blocking overlays not known to `main.ts`/`game.ts` leave HUD or phone controls active underneath.
- Rendering from stale local state desyncs reward/vendor/dialog UI.
- Raw `click` handlers can double-activate touch buttons.
- Embedding settings/progression logic duplicates owning systems.
- Missing route/end dataset/id contracts makes `game.ts` ignore buttons.
- Treating palette snapshots as saves expands shell ownership.
- Silent snapshot storage/map failures leave stuck UI.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
