// @system   game-runtime/app-loop
// @owns     toggle run pause state through the app state controller
// @doc      docs/canonical/game_runtime_app_loop.md
// @agents   no keyboard input routing or loop stepping; see input.ts and game.ts

import { AppState, RunState, type AppStateController } from "./appState";

export function togglePause(
  controller: AppStateController,
  currentAppState: AppState
): boolean {
  if (currentAppState !== AppState.RUN) return false;

  const nextRunState = controller.runState === RunState.PAUSED ? RunState.PLAYING : RunState.PAUSED;
  controller.setRunState(nextRunState);
  return true;
}
