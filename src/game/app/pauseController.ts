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
