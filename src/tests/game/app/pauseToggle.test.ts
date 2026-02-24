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
    const ui = { setVisible: vi.fn() };

    const changed = togglePause(controller, AppState.MENU, ui);
    expect(changed).toBe(false);
    expect(controller.runState).toBe(RunState.PLAYING);
    expect(ui.setVisible).not.toHaveBeenCalled();
  });

  test("toggles PLAYING -> PAUSED and shows UI", () => {
    const controller = makeController(RunState.PLAYING);
    const ui = { setVisible: vi.fn() };

    const changed = togglePause(controller, AppState.RUN, ui);
    expect(changed).toBe(true);
    expect(controller.runState).toBe(RunState.PAUSED);
    expect(ui.setVisible).toHaveBeenCalledWith(true);
  });

  test("toggles PAUSED -> PLAYING and hides UI", () => {
    const controller = makeController(RunState.PAUSED);
    const ui = { setVisible: vi.fn() };

    const changed = togglePause(controller, AppState.RUN, ui);
    expect(changed).toBe(true);
    expect(controller.runState).toBe(RunState.PLAYING);
    expect(ui.setVisible).toHaveBeenCalledWith(false);
  });
});
