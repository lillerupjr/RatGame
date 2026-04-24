# Game Runtime / App Loop

## Purpose

- Orchestrate application bootstrap, app-level state transitions, loading-stage execution, pause gating, and the top-level frame loop.
- Decide when the game is booting, showing menus, loading content, updating simulation, or rendering a paused/live run.

## Scope

- `bootstrap()` and the top-level `requestAnimationFrame` loop in `src/main.ts`
- App-level state control via `AppState`, `RunState`, and `AppStateController`
- Pause gating via `togglePause()`
- Loading orchestration via `createLoadingController()` and its hooks
- The public `createGame()` runtime surface used by `src/main.ts`:
  - start intent queue/consume
  - floor-load intent queue/consume
  - map/start preparation
  - floor-load preparation/finalization
  - `update()`
  - `render()`
  - `quitRunToMenu()`
- Top-level UI visibility sync that is keyed directly off app/run state

## Non-scope

- The internal gameplay systems executed by `game.update()` such as combat, movement, projectiles, objectives, or bosses
- The internal world renderer executed by `game.render()`
- The world data model defined in `src/engine/world/world.ts`
- Detailed menu, settings, vendor, reward, or dialog UI implementations
- Map compilation, sprite prewarming, and floor finalization internals beyond how this system sequences them

## Key Entrypoints

- `src/main.ts`
- `src/game/game.ts`
- `src/game/app/appState.ts`
- `src/game/app/loadingFlow.ts`
- `src/game/app/pauseController.ts`
- `src/game/app/loadingScreen.ts`

## Data Flow / Pipeline

1. **Bootstrap**
   - `bootstrap()` hides preboot screens, initializes user settings, applies audio preferences, mounts UI surfaces, configures 2D/WebGL canvases, and creates the `game` instance.
   - `bootstrap()` also creates:
     - `appStateController`
     - `loadingController`
     - pause/dev/settings UI glue
     - frame-local runtime orchestration state such as `activeStartIntent`, `activeFloorIntent`, and `loadingDoneNextState`

2. **Boot Phase**
   - The frame loop starts in `AppState.BOOT`.
   - `bootTick()` runs from the frame loop:
     - first pass: `game.preloadBootAssets()` and `bootProgress = 0.5`
     - next pass: `bootProgress = 1` and `appState = MENU`
   - BOOT frames render only the loading screen.

3. **Menu Phase**
   - `AppState.MENU` polls the `game` instance for pending intents.
   - `consumePendingFloorLoadIntent()` takes priority and moves the app into `LOADING`.
   - `consumePendingStartIntent()` then handles queued run starts:
     - `SANDBOX`: enters `LOADING`
     - `DELVE` and `DETERMINISTIC`: call `prepareStartMap()` and `performPreparedStartIntent()` immediately and stay out of `LOADING` until a floor is chosen

4. **Loading Phase**
   - `beginMapLoad()` resets the loading controller and starts a new profiler session.
   - `tick()` advances a fixed stage pipeline:
     1. `COMPILE_MAP`
     2. `PRECOMPUTE_STATIC_MAP`
     3. `PREWARM_DEPENDENCIES`
     4. `PREPARE_STRUCTURE_TRIANGLES`
     5. `PRIME_AUDIO`
     6. `SPAWN_ENTITIES`
     7. `FINALIZE`
   - In `src/main.ts`, these stages are wired to either the start-intent path or the floor-load path:
     - start path: `prepareStartMap()` -> prewarm active map -> `performPreparedStartIntent()`
     - floor path: `beginFloorLoad()` -> prewarm floor sprites -> `finalizeFloorLoad()`
   - While loading, frames render only the loading screen.

5. **Post-Load Transition**
   - After `loadingController.isDone()` becomes true, `src/main.ts` holds one additional loading frame before changing app state.
   - When transitioning into `RUN`, `runState` is forced to `PLAYING`.

6. **Run Phase**
   - In `AppState.RUN`, the frame loop first checks whether `game.getWorld().state === "MENU"`.
   - If so, the app returns to `MENU`.
   - Otherwise:
     - if `runState === PLAYING`, `game.update(dtReal)` runs
     - `game.render(dtReal)` always runs
   - During RUN, a newly queued floor-load intent can move the app back into `LOADING`.

7. **Pause Path**
   - `togglePause()` only changes `runState` while `appState === RUN`.
   - Paused RUN frames skip `game.update()` but still execute `game.render()`.
   - Pause-menu visibility is controlled in `src/main.ts`, not in `togglePause()`.

8. **Run Exit Path**
   - `quitRunToMenu()` in `src/game/game.ts` clears pending runtime intents and floor-load context, resets world/menu-related state, hides overlays, and sets `world.state = "MENU"`.
   - The top-level frame loop observes that world state and returns the app to `AppState.MENU`.
   - The pause-menu quit action sets `AppState.MENU` immediately before calling `quitRunToMenu()`.

9. **First Visible RUN Frame**
   - After a load completes into RUN, `src/main.ts` marks the first visible RUN frame with `loadingController.markFirstVisibleFrame()`.
   - The same path performs a sprite-readiness diagnostic and logs unresolved sprites if any remain.

## Core Invariants

- `AppStateController` initializes with:
  - `appState = BOOT`
  - `runState = PLAYING`
- `togglePause()` returns `false` and does nothing unless the current app state is `RUN`.
- `game.update()` is only called when:
  - `appState === RUN`
  - `runState === PLAYING`
- `game.render()` is called on every RUN frame, including paused frames.
- Loading stages run in fixed order and only one stage runs at a time.
- `PREWARM_DEPENDENCIES` is the only loading stage in this controller with fail-open thresholds:
  - attempt limit: `4`
  - elapsed limit: `9000 ms`
- The loading screen remains visible for one extra rendered frame after the loading controller reports done.
- `pendingStartIntent` and `pendingFloorIntent` in `src/game/game.ts` are single-slot handoff fields, not multi-entry queues.
- `consumePendingStartIntent()` and `consumePendingFloorLoadIntent()` clear the stored intent when read.
- `DELVE` and `DETERMINISTIC` start intents do not enter `LOADING` at character selection time.
- `beginFloorLoad()` sets `floorLoadContext` only after authored map activation succeeds and, for delve runs, pending-node commit succeeds.
- `finalizeFloorLoad()` returns the runtime to `world.state = "RUN"` and clears `floorLoadContext`.
- `quitRunToMenu()` clears:
  - pending start intent
  - pending floor intent
  - prepared start state
  - floor-load context
  before leaving the runtime in menu state

## Design Constraints

- App-level runtime orchestration must remain centralized in the top-level bootstrap/frame-loop path plus the `createGame()` runtime surface.
- App pause state must be owned by `AppStateController`; it must not be modeled by `world.runState`.
- Simulation stepping must remain gated by `appState === RUN` and `runState === PLAYING`.
- Rendering of the world frame may continue while the app is paused.
- Load-stage execution must go through `LoadingController`; map/start/floor loading stages must not be split into unrelated ad hoc entry paths without updating this document.

## Dependencies (In/Out)

### Incoming

- Browser frame scheduling via `requestAnimationFrame`
- DOM/canvas references from `getDomRefs()`
- User settings from `initUserSettings()` / `getUserSettings()`
- UI-triggered start requests routed through:
  - `startRun()`
  - `startDeterministicRun()`
  - `startSandboxRun()`
- World-state exits signaled by `game.getWorld().state`

### Outgoing

- Calls into the `createGame()` runtime surface:
  - `preloadBootAssets()`
  - `prepareStartMap()`
  - `performPreparedStartIntent()`
  - `beginFloorLoad()`
  - `prewarmFloorLoadSprites()`
  - `prepareRuntimeStructureTrianglesForLoading()`
  - `finalizeFloorLoad()`
  - `update()`
  - `render()`
  - `quitRunToMenu()`
- Calls into loading/profiling support:
  - `createLoadingController()`
  - `attachLoadProfilerGlobal()`
  - `markFirstVisibleFrame()`
- Calls into app-shell helpers:
  - pause menu mounting/rendering
  - settings/dev-tools refresh hooks
  - world-backend visibility sync

## Extension Points

- `LoadingHooks` in `createLoadingController()`
- `LoadingStage` and the `stageOrder` sequence in `src/game/app/loadingFlow.ts`
- `StartIntent` and the queue/consume handoff in `src/game/game.ts`
- Load-profiler subphases via:
  - `runWithLoadProfilerSubphase()`
  - `runWithLoadProfilerSubphaseAsync()`
- The public runtime surface returned by `createGame()`

## Failure Modes / Common Mistakes

- Calling `togglePause()` outside `AppState.RUN` has no effect.
- Expecting a loading screen immediately after selecting a character for `DELVE` or `DETERMINISTIC` is incorrect; those modes defer loading until a floor is selected.
- `beginFloorLoad()` can return `false` and reopen the delve map when floor entry cannot be committed or no valid authored map can be resolved.
- `PREWARM_DEPENDENCIES` can fail-open after its configured attempt/elapsed limits; load completion does not guarantee that stage finished with `completed` status.
- Returning to menu by mutating only `world.state` does not immediately switch the app loop out of `RUN`; the top-level frame loop performs that transition on the next frame unless another path sets `AppState.MENU` directly.
- Because start and floor intents are single-slot fields, an unconsumed intent can be overwritten by a later write.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
