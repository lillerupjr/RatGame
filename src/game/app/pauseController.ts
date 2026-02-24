import { AppState, RunState, type AppStateController } from "./appState";

export interface PauseUiController {
  setVisible(visible: boolean): void;
}

export function togglePause(
  controller: AppStateController,
  currentAppState: AppState,
  pauseUi: PauseUiController
): boolean {
  if (currentAppState !== AppState.RUN) return false;

  const nextRunState = controller.runState === RunState.PAUSED ? RunState.PLAYING : RunState.PAUSED;
  controller.setRunState(nextRunState);
  pauseUi.setVisible(nextRunState === RunState.PAUSED);
  return true;
}
