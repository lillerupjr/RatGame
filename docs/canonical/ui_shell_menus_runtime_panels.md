# UI Shell / Menus / Runtime Panels

## Purpose

- Own the DOM-facing shell around the game runtime: static element lookup, menu-screen choreography, pause/runtime overlay controllers, and touch/dialog/reward/vendor interaction surfaces.
- Define how UI surfaces are mounted, shown, hidden, and connected to game/runtime callbacks without taking ownership of gameplay state themselves.

## Scope

- Static DOM lookup and typed UI ref assembly in:
  - `src/ui/domRefs.ts`
- Menu-screen wiring and menu-local state in:
  - `src/ui/menuWiring.ts`
- Pause overlay controller in:
  - `src/ui/pause/pauseMenu.ts`
- Runtime overlay/panel controllers in:
  - `src/ui/rewards/relicRewardMenu.ts`
  - `src/ui/vendor/vendorShopMenu.ts`
  - `src/ui/dialog/renderDialogChoices.ts`
  - `src/ui/mobile/mobileControls.ts`
  - `src/ui/paletteLab/snapshotViewerPalettePanel.ts`
  - `src/ui/interaction/tapSafeActivate.ts`
- Top-level UI shell bootstrap and app-state visibility choreography in:
  - `src/main.ts`
- Runtime-side UI mounting and DOM update flow in:
  - `src/game/game.ts`

## Non-scope

- Settings storage semantics and debug/system override ownership; those belong to the settings system doc
- World rendering, render-command generation, and canvas drawing pipelines
- Gameplay logic behind rewards, vendors, objectives, routes, or dialogue content
- Database/leaderboard behavior beyond the end-screen UI consuming its results

## Key Entrypoints

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

## Data Flow / Pipeline

1. **Static DOM Discovery**
   - `getDomRefs()` is the typed lookup boundary for the static DOM declared in `index.html`.
   - Missing required elements throw immediately.
   - `getDomRefs()` also assembles grouped ref bundles for:
     - HUD
     - map overlay
     - end overlay
     - dialog overlay
   - It programmatically inserts the HUD perf-overlay `<select>` into the HUD shell.

2. **Bootstrap and Shell Wiring**
   - `main.ts` initializes settings, creates the game runtime, and mounts top-level UI controllers:
     - main settings panel
     - dev tools panel
     - pause menu
     - snapshot viewer palette panel
   - It then calls `wireMenus(refs, gameApi)` so the menu shell talks to the runtime through explicit callbacks, not direct world mutation.

3. **App-State Visibility Choreography**
   - `syncUiForAppState(...)` in `main.ts` is the top-level visibility coordinator for:
     - boot/loading screens
     - menu screens
     - pause overlay
     - HUD
     - route map
     - end screen
     - dialog/reward/vendor blocking overlays
   - In `RUN`, it computes whether any blocking overlay is open and uses that to gate mobile controls and HUD visibility.
   - In `MENU`, it keeps exactly the active menu-style screen visible, defaulting back to the welcome screen if none is visible.

4. **Menu-Screen System**
   - `wireMenus(...)` owns the menu-local UI state for:
     - selected character
     - selected authored map
     - pending start mode (`DELVE` / `DETERMINISTIC` / `SANDBOX`)
     - starter modal visibility
     - palette-lab snapshot card rendering
   - Palette Lab browsing is a menu-shell workflow:
     - list IndexedDB-backed snapshot records
     - render thumbnail/name/timestamp/map label cards
     - rename and delete records from the menu shell
     - delegate snapshot opening through the injected runtime callback
   - Menu actions route through the injected `GameApi`:
     - `previewMap(...)`
     - `startRun(...)`
     - `startDeterministicRun(...)`
     - `startSandboxRun(...)`
     - `openPaletteSnapshot(...)`
   - User-mode gating is applied from settings so dev-only menu affordances disappear in normal play.
   - Touch/pointer activation is normalized with the menu-local `bindActivate(...)` helper to suppress duplicate synthetic click behavior.

5. **Pause Overlay**
   - `mountPauseMenu(...)` mounts a controller into the shared menu root used for pause state.
   - It preserves the root’s prior children, hides them while pause UI is active, and restores them when the pause overlay closes.
   - The pause menu owns section switching, quit confirmation, debug relic editor visibility, and embedded read-only build/debug stats views.
   - It embeds a settings panel controller, but settings persistence itself stays in the settings system.
   - Palette snapshot capture begins here:
     - `pauseMenu.ts` captures a visual-only snapshot draft from the current world
     - `main.ts` builds the thumbnail artifact from the active render canvas and persists it
   - The pause menu does not mutate run state directly; it calls the callbacks passed from `main.ts` (`onResume`, `onQuitRun`, `onOpenDevTools`, `onSavePaletteSnapshot`).

6. **Runtime Overlay Controllers**
   - `game.ts` mounts reward and vendor overlays into ad hoc body roots:
     - `mountRelicRewardMenu(...)`
     - `mountVendorShopMenu(...)`
   - These overlays are render-from-state controllers:
     - `render(...)` consumes current UI state
     - callbacks return user intent to `game.ts`
   - `game.ts` remains the authority for state transitions after a click:
     - choose relic reward
     - buy vendor relic
     - leave vendor and resolve advancement
   - `renderDialogChoices(...)` renders the current dialog choice list from a small render model produced by `game.ts`.

7. **Dialog / Interaction Shell**
   - `game.ts` owns transient `activeDialog` state and writes dialog text/choices into `args.ui.dialogEl`.
   - The HUD interaction prompt is also a UI-shell output owned by `game.ts`, derived from:
     - current run state
     - active dialog
     - vendor-open state
     - nearby interactable resolution
     - whether phone controls are active
   - Dialog and vendor overlays are mutually coordinated:
     - opening vendor clears dialog
     - reward pipeline closes dialog/vendor before showing reward UI

8. **Touch / Mobile Controls**
   - `createMobileControls(...)` owns the floating virtual-stick/interact controller bound to HUD DOM nodes.
   - It converts pointer input into callbacks:
     - `onMove(x, y, active)`
     - `onInteractDown(down)`
   - `game.ts` adapts those callbacks into virtual sim input through `setVirtualMoveAxes(...)` and `setVirtualInteractDown(...)`.
   - `main.ts` is the authority for whether mobile controls are enabled at all, based on run state and blocking overlays.

9. **Map, End, and Snapshot-Viewer Surfaces**
   - `game.ts` owns DOM updates for:
     - HUD pills / vitals orb / boss bar / objective text
     - route map content and click payload handling
     - end-screen stats and leaderboard tabs
   - Route-map clicks are interpreted from DOM dataset payloads and converted into queued floor-load intents.
   - End-screen buttons route back into retry/quit handlers in `game.ts`.
   - `main.ts` owns visibility for the palette snapshot viewer panel, while `game.ts` owns opening a snapshot record and rerolling its seed.
   - Snapshot viewer controls:
     - are shown only during `RUN` + `PLAYING` when the runtime marks `paletteSnapshotViewerActive`
     - route `Close` back to the Palette Lab menu
     - route `Reroll Seed` back into `game.ts`
     - write palette/light controls through the settings facade instead of mutating render state directly

## Core Invariants

- `getDomRefs()` is the single typed lookup boundary for the static app DOM; missing required elements are fatal.
- `main.ts` owns top-level shell visibility across `BOOT`, `LOADING`, `MENU`, and `RUN`.
- `menuWiring.ts` must communicate with runtime through the injected `GameApi`; it is not a world-state authority.
- Runtime overlay controllers (`reward`, `vendor`, `dialog`, `pause`, `snapshot viewer`) render from state plus callbacks; they do not own canonical gameplay state.
- Blocking overlays must gate phone controls. Mobile controls are only enabled during active run play with no blocking overlay open.
- `pauseMenu.ts` preserves and restores the prior children of its root host instead of assuming ownership of the root forever.
- Route-map and end-screen interactions depend on explicit DOM payload/button contracts handled in `game.ts`.
- Touch-facing overlays that need click suppression must use the existing tap-safe activation pattern rather than raw `click` handlers alone.
- Settings visibility inside the shell depends on user mode, but settings storage truth remains outside this system.
- Palette snapshots are local visual-scene artifacts, not gameplay saves, run persistence, progression persistence, or inventory persistence.
- Palette Lab browse/rename/delete actions operate on IndexedDB-backed snapshot records and must surface failures through the shell rather than crashing it.
- Snapshot viewer controls are visible only when the runtime explicitly reports snapshot-viewer mode; closing that viewer returns the shell to the Palette Lab menu.

## Design Constraints

- New static shell elements should be added through `domRefs.ts` so the app keeps a typed, centralized DOM contract.
- New menu or runtime UI surfaces should use controller-style boundaries:
  - receive state / callbacks
  - render DOM
  - return user intent
  rather than owning world mutation internally
- High-level screen visibility changes must stay coordinated through `main.ts` app-state sync, not by scattering permanent hidden-state changes across unrelated modules.
- New blocking overlays must participate in mobile-control and visibility gating, or they will conflict with touch input and HUD state.
- Settings, progression, vendor, reward, and gameplay semantics should stay in their parent systems. This shell may present them, but should not become a second authority for them.
- Touch-driven buttons in overlays and menus should continue to use the repo’s pointer/tap-safe activation helpers where duplicate click behavior is a risk.
- Keep palette snapshot payloads and storage visual-only. Do not expand this workflow into save/load, checkpoint, run-persistence, or inventory ownership.
- Snapshot records remain local artifacts in the snapshot storage system; do not move them into `localStorage`, auto-overwrite them, or silently auto-delete them.
- Snapshot viewer palette/light controls must continue to route through the settings system instead of introducing a second render-only state channel.

## Dependencies (In/Out)

### Incoming

- Static HTML shell from `index.html`
- App/run state from `main.ts`
- Game runtime callbacks and world snapshots from `src/game/game.ts`
- User-mode and settings reads from:
  - `src/userSettings.ts`
  - embedded settings/dev-tools controllers
- Palette snapshot storage/actions from `src/game/paletteLab/snapshotStorage.ts`

### Outgoing

- Start/preview/open actions into the game runtime via `GameApi`
- Pause actions back into `main.ts`
- Mobile virtual input into the simulation input system
- Reward/vendor/dialog choice callbacks back into `game.ts`
- Screen/overlay visibility that affects HUD, touch controls, and app-state presentation

## Extension Points

- Add a new static menu/shell screen by:
  - adding DOM refs
  - wiring its visibility in `main.ts`
  - extending `menuWiring.ts` or a dedicated controller
- Add a new runtime overlay by creating a mount/render controller and having `game.ts` feed it state plus callbacks
- Add a new pause section by extending `PauseSectionId`, nav/button wiring, and panel rendering in `pauseMenu.ts`
- Add a new route-map interaction by encoding explicit DOM dataset payloads that `game.ts` can interpret into runtime intents
- Add a new specialized snapshot-viewer or palette-lab control panel by mounting another controller from `main.ts`

## Failure Modes / Common Mistakes

- Mutating world state directly from `menuWiring.ts` bypasses the intended callback boundary and creates shell/runtime coupling.
- Adding new static DOM ids without updating `domRefs.ts` causes runtime lookup failures or hidden-state drift.
- Opening a new overlay without teaching `main.ts` and `game.ts` that it is blocking leaves phone controls or HUD state incorrectly active underneath it.
- Rendering overlay state from internal stale local state instead of runtime inputs causes reward/vendor/dialog UIs to desync from the world.
- Using raw `click` handlers for touch-facing buttons where tap-safe suppression is needed can cause duplicate activations.
- Embedding settings or progression logic inside shell controllers duplicates the actual owning systems.
- Adding route-map or end-screen buttons without the expected dataset/id contracts means `game.ts` will ignore them.
- Treating palette snapshots as gameplay saves or hidden persistence payloads expands the shell beyond its ownership boundary.
- Failing to surface missing-map or storage errors during palette snapshot open/rename/delete leaves the shell in a silent-failure state.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
