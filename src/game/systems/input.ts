export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export function createInputState(): InputState {
  const s: InputState = { up: false, down: false, left: false, right: false };

  window.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") s.up = true;
    if (e.key === "s" || e.key === "ArrowDown") s.down = true;
    if (e.key === "a" || e.key === "ArrowLeft") s.left = true;
    if (e.key === "d" || e.key === "ArrowRight") s.right = true;
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") s.up = false;
    if (e.key === "s" || e.key === "ArrowDown") s.down = false;
    if (e.key === "a" || e.key === "ArrowLeft") s.left = false;
    if (e.key === "d" || e.key === "ArrowRight") s.right = false;
  });

  return s;
}

export function inputSystem(_input: InputState, _canvas: HTMLCanvasElement) {
  // Placeholder for mouse aim later (pistol targeting, UI clicks, etc.)
}
