# Game Runtime / App Loop

## Purpose

Own application bootstrap, app-level state transitions, loading-stage execution, pause gating, and the top-level `requestAnimationFrame` loop that decides when the app boots, menus, loads, updates, or renders.

## Scope

- `bootstrap()` and frame loop in `src/main.ts`
- `AppState`, `RunState`, `AppStateController`
- Pause gating via `togglePause()`
- Loading orchestration via `createLoadingController()` and hooks
- `createGame()` runtime surface used by `main.ts`: start/floor intents, map/start prep, floor-load prep/finalize, `update()`, `render()`, `quitRunToMenu()`
- Top-level UI visibility sync keyed from app/run state

## Non-scope

- Systems inside `game.update()` such as combat, movement, objectives, bosses: `docs/canonical/core_simulation_combat_runtime.md`, `docs/canonical/progression_objectives_rewards.md`, `docs/canonical/boss_encounter_system.md`
- Renderer internals inside `game.render()`: `docs/canonical/presentation_rendering_pipeline.md`
- World data model: `docs/canonical/world_state_runtime_data_model.md`
- Menu/settings/vendor/reward/dialog internals: `docs/canonical/ui_shell_menus_runtime_panels.md`, `docs/canonical/settings_overrides_debug_controls.md`
- Map compilation, sprite prewarm, floor finalization internals beyond sequencing: `docs/canonical/map_compilation_activation_floor_topology.md`

## Entrypoints

- `src/main.ts`
- `src/game/game.ts`
- `src/game/app/appState.ts`
- `src/game/app/loadingFlow.ts`
- `src/game/app/pauseController.ts`
- `src/game/app/loadingScreen.ts`

## Pipeline

1. **Bootstrap**: `bootstrap()` hides preboot UI, initializes settings/audio, mounts UI surfaces, configures Canvas2D/WebGL canvases, creates `game`, `appStateController`, `loadingController`, pause/dev/settings glue, and frame-local orchestration state (`activeStartIntent`, `activeFloorIntent`, `loadingDoneNextState`).
2. **BOOT**: frame loop starts in `AppState.BOOT`; `bootTick()` first runs `game.preloadBootAssets()` and `bootProgress = 0.5`, next sets `bootProgress = 1` and `MENU`. BOOT renders only loading screen.
3. **MENU**: polls `game` for pending intents. `consumePendingFloorLoadIntent()` takes priority and enters `LOADING`. `consumePendingStartIntent()` handles starts: `SANDBOX` enters `LOADING`; `DELVE`/`DETERMINISTIC` call `prepareStartMap()` and `performPreparedStartIntent()` immediately, deferring loading until floor choice.
4. **LOADING**: `beginMapLoad()` resets controller/profiler. `tick()` advances one fixed stage at a time: `COMPILE_MAP`, `PRECOMPUTE_STATIC_MAP`, `PREWARM_DEPENDENCIES`, `PREPARE_STRUCTURE_TRIANGLES`, `PRIME_AUDIO`, `SPAWN_ENTITIES`, `FINALIZE`. Start path: `prepareStartMap()` -> prewarm active map -> `performPreparedStartIntent()`. Floor path: `beginFloorLoad()` -> prewarm sprites -> `finalizeFloorLoad()`. LOADING renders only loading screen.
5. **Post-Load**: after `loadingController.isDone()`, `main.ts` holds one extra loading frame before state change; transitions to `RUN` force `runState = PLAYING`.
6. **RUN**: if `game.getWorld().state === "MENU"`, app returns to `MENU`; otherwise `game.update(dtReal)` runs only in `PLAYING`, while `game.render(dtReal)` always runs. Queued floor-load intent can return to `LOADING`.
7. **Pause**: `togglePause()` only changes `runState` in `RUN`. Paused frames skip update and still render. Pause menu visibility is controlled in `main.ts`.
8. **Run Exit**: `quitRunToMenu()` clears pending intents, prepared/floor-load context, world/menu state, overlays, and sets `world.state = "MENU"`. The frame loop observes and returns to `MENU`; pause-menu quit also sets `AppState.MENU` immediately.
9. **First Visible RUN Frame**: after load into RUN, `markFirstVisibleFrame()` runs and sprite-readiness diagnostics log unresolved sprites.

## Invariants

- `AppStateController` starts with `appState = BOOT`, `runState = PLAYING`.
- `togglePause()` returns `false` and does nothing outside `RUN`.
- `game.update()` requires `appState === RUN` and `runState === PLAYING`.
- `game.render()` runs on every RUN frame, including pause.
- Loading stages are fixed-order, one at a time.
- `PREWARM_DEPENDENCIES` is the only fail-open loading stage: attempt limit `4`, elapsed limit `9000 ms`.
- Loading screen remains visible one extra rendered frame after controller done.
- `pendingStartIntent` and `pendingFloorIntent` are single-slot handoff fields; consume calls clear them.
- `DELVE` and `DETERMINISTIC` do not enter `LOADING` at character selection time.
- `beginFloorLoad()` sets `floorLoadContext` only after authored map activation succeeds and delve pending-node commit succeeds.
- `finalizeFloorLoad()` sets `world.state = "RUN"` and clears `floorLoadContext`.
- `quitRunToMenu()` clears pending start/floor intent, prepared start state, and floor-load context before menu state.

## Constraints

- App orchestration stays centralized in bootstrap/frame loop plus `createGame()` surface.
- App pause is `AppStateController` state, not `world.runState`.
- Simulation stepping remains gated by `RUN` + `PLAYING`; rendering may continue while paused.
- Load-stage execution must go through `LoadingController`; ad hoc map/start/floor loading paths require doc updates.

## Dependencies

### Incoming

- `requestAnimationFrame`
- DOM/canvas refs from `getDomRefs()`
- Settings from `initUserSettings()` / `getUserSettings()`
- UI start requests through `startRun()`, `startDeterministicRun()`, `startSandboxRun()`
- World exits via `game.getWorld().state`

### Outgoing

- `createGame()` calls: `preloadBootAssets()`, `prepareStartMap()`, `performPreparedStartIntent()`, `beginFloorLoad()`, `prewarmFloorLoadSprites()`, `prepareRuntimeStructureTrianglesForLoading()`, `finalizeFloorLoad()`, `update()`, `render()`, `quitRunToMenu()`
- Loading/profiling calls: `createLoadingController()`, `attachLoadProfilerGlobal()`, `markFirstVisibleFrame()`
- Shell calls: pause menu mount/render, settings/dev refresh hooks, backend visibility sync

## Extension

- `LoadingHooks`, `LoadingStage`, and `stageOrder` in `src/game/app/loadingFlow.ts`
- `StartIntent` and intent handoff in `src/game/game.ts`
- Load-profiler subphases via `runWithLoadProfilerSubphase()` and `runWithLoadProfilerSubphaseAsync()`
- Public runtime surface returned by `createGame()`

## Failure Modes

- `togglePause()` outside `RUN` has no effect.
- `DELVE`/`DETERMINISTIC` character selection does not show loading until floor selection.
- `beginFloorLoad()` can fail and reopen delve map when floor commit or map resolution fails.
- `PREWARM_DEPENDENCIES` fail-open means load completion may not mean `completed` status.
- Mutating only `world.state` to menu switches app loop on the next frame unless another path sets `AppState.MENU`.
- Single-slot intents can be overwritten by later writes before consumption.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
