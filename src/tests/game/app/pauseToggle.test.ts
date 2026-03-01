import { describe, expect, test, vi } from "vitest";
import { AppState, RunState, type AppStateController } from "../../../game/app/appState";
import { togglePause } from "../../../game/app/pauseController";

function makeController(runState: RunState): AppStateController {
  return {
    appState: AppState.RUN,
    runState,
    setAppState: vi.fn(),
    setRunState(state) {
      this.runState = state;
    },
  };
}

describe("togglePause", () => {
  test("no-op when not in RUN", () => {
    const controller = makeController(RunState.PLAYING);

    const changed = togglePause(controller, AppState.MENU);
    expect(changed).toBe(false);
    expect(controller.runState).toBe(RunState.PLAYING);
  });

  test("toggles PLAYING -> PAUSED", () => {
    const controller = makeController(RunState.PLAYING);

    const changed = togglePause(controller, AppState.RUN);
    expect(changed).toBe(true);
    expect(controller.runState).toBe(RunState.PAUSED);
  });

  test("toggles PAUSED -> PLAYING", () => {
    const controller = makeController(RunState.PAUSED);

    const changed = togglePause(controller, AppState.RUN);
    expect(changed).toBe(true);
    expect(controller.runState).toBe(RunState.PLAYING);
  });
});
