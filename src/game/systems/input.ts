export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** True while spacebar is held */
  jump: boolean;
  /** True only on the frame jump was pressed (edge-triggered) */
  jumpPressed: boolean;
};

export function createInputState(): InputState {
  const s: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
  };

  window.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") s.up = true;
    if (e.key === "s" || e.key === "ArrowDown") s.down = true;
    if (e.key === "a" || e.key === "ArrowLeft") s.left = true;
    if (e.key === "d" || e.key === "ArrowRight") s.right = true;
    if (e.key === " ") {
      // Edge detection: only set jumpPressed if not already jumping
      if (!s.jump) s.jumpPressed = true;
      s.jump = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") s.up = false;
    if (e.key === "s" || e.key === "ArrowDown") s.down = false;
    if (e.key === "a" || e.key === "ArrowLeft") s.left = false;
    if (e.key === "d" || e.key === "ArrowRight") s.right = false;
    if (e.key === " ") s.jump = false;
  });

  return s;
}

/**
 * Clear per-frame edge-triggered inputs.
 * Call this at the END of each frame to reset jumpPressed.
 */
export function clearInputEdges(input: InputState) {
  input.jumpPressed = false;
}

export function inputSystem(_input: InputState, _canvas: HTMLCanvasElement) {
  // Placeholder for mouse aim later (pistol targeting, UI clicks, etc.)
}
