// @system   game-runtime/app-loop
// @owns     defines AppState/RunState enums and mutable app-state controller
// @doc      docs/canonical/game_runtime_app_loop.md
// @agents   no pause policy, loading stages, or frame loop; see pauseController.ts, loadingFlow.ts, and src/main.ts

export const enum AppState {
  BOOT = 0,
  MENU = 1,
  LOADING = 2,
  RUN = 3,
}

export const enum RunState {
  PLAYING = 0,
  PAUSED = 1,
}

export interface AppStateController {
  appState: AppState;
  runState: RunState;

  setAppState(state: AppState): void;
  setRunState(state: RunState): void;
}

export function createAppStateController(): AppStateController {
  const controller: AppStateController = {
    appState: AppState.BOOT,
    runState: RunState.PLAYING,
    setAppState(state: AppState) {
      controller.appState = state;
    },
    setRunState(state: RunState) {
      controller.runState = state;
    },
  };
  return controller;
}
