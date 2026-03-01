export type InputState = {
  /** Composed movement x-axis in screen-grid space, -1..1 */
  moveX: number;
  /** Composed movement y-axis in screen-grid space, -1..1 */
  moveY: number;
  /** Composed movement magnitude, 0..1 */
  moveMag: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** True while spacebar is held */
  jump: boolean;
  /** True only on the frame jump was pressed (edge-triggered) */
  jumpPressed: boolean;
  /** True while interact is held */
  interact: boolean;
  /** True only on the frame interact was pressed (edge-triggered) */
  interactPressed: boolean;
  _keyUp?: boolean;
  _keyDown?: boolean;
  _keyLeft?: boolean;
  _keyRight?: boolean;
  _keyInteract?: boolean;
  _virtualMoveActive?: boolean;
  _virtualMoveX?: number;
  _virtualMoveY?: number;
  _virtualInteractDown?: boolean;
  _interactComposedPrev?: boolean;
};

export type CameraSafeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
};

export function screenToCameraLocal(
  screenX: number,
  screenY: number,
  safeRect: CameraSafeRect,
): { x: number; y: number; inside: boolean } {
  const x = screenX - safeRect.x;
  const y = screenY - safeRect.y;
  const inside = x >= 0 && y >= 0 && x <= safeRect.width && y <= safeRect.height;
  return { x, y, inside };
}

export function cameraLocalToWorld(
  localX: number,
  localY: number,
  safeRect: CameraSafeRect,
): { x: number; y: number } {
  const z = Math.max(1, Math.floor(safeRect.zoom));
  return { x: localX / z, y: localY / z };
}

const VIRTUAL_MOVE_DEADZONE = 0.22;
const VIRTUAL_MOVE_DEADZONE_RADIAL = 0.18;

function ensureInternalState(input: InputState): void {
  if (!Number.isFinite(input.moveX)) input.moveX = 0;
  if (!Number.isFinite(input.moveY)) input.moveY = 0;
  if (!Number.isFinite(input.moveMag)) input.moveMag = 0;
  if (typeof input._keyUp !== "boolean") input._keyUp = false;
  if (typeof input._keyDown !== "boolean") input._keyDown = false;
  if (typeof input._keyLeft !== "boolean") input._keyLeft = false;
  if (typeof input._keyRight !== "boolean") input._keyRight = false;
  if (typeof input._keyInteract !== "boolean") input._keyInteract = false;
  if (typeof input._virtualMoveActive !== "boolean") input._virtualMoveActive = false;
  if (typeof input._virtualMoveX !== "number") input._virtualMoveX = 0;
  if (typeof input._virtualMoveY !== "number") input._virtualMoveY = 0;
  if (typeof input._virtualInteractDown !== "boolean") input._virtualInteractDown = false;
  if (typeof input._interactComposedPrev !== "boolean") input._interactComposedPrev = !!input.interact;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function composeVirtualAnalogMove(input: InputState): { x: number; y: number; mag: number } {
  if (!input._virtualMoveActive) return { x: 0, y: 0, mag: 0 };
  const rawX = clampUnit(input._virtualMoveX as number);
  const rawY = clampUnit(input._virtualMoveY as number);
  const rawMag = Math.hypot(rawX, rawY);
  if (rawMag <= VIRTUAL_MOVE_DEADZONE_RADIAL) return { x: 0, y: 0, mag: 0 };
  const dirX = rawMag > 1e-6 ? rawX / rawMag : 0;
  const dirY = rawMag > 1e-6 ? rawY / rawMag : 0;
  const remappedMag = clamp01((Math.min(1, rawMag) - VIRTUAL_MOVE_DEADZONE_RADIAL) / (1 - VIRTUAL_MOVE_DEADZONE_RADIAL));
  return {
    x: dirX * remappedMag,
    y: dirY * remappedMag,
    mag: remappedMag,
  };
}

function composeKeyboardDigitalMove(input: InputState): { x: number; y: number; mag: number } {
  let x = 0;
  let y = 0;
  if (input._keyLeft) x -= 1;
  if (input._keyRight) x += 1;
  if (input._keyUp) y += 1;
  if (input._keyDown) y -= 1;
  const len = Math.hypot(x, y);
  if (len <= 1e-6) return { x: 0, y: 0, mag: 0 };
  return { x: x / len, y: y / len, mag: 1 };
}

function recomputeDirectionalFromSources(input: InputState): void {
  ensureInternalState(input);
  const virtual = composeVirtualAnalogMove(input);
  const keyboard = composeKeyboardDigitalMove(input);

  if (input._virtualMoveActive) {
    input.moveX = virtual.x;
    input.moveY = virtual.y;
    input.moveMag = virtual.mag;
  } else {
    input.moveX = keyboard.x;
    input.moveY = keyboard.y;
    input.moveMag = keyboard.mag;
  }

  const virtualLeft = virtual.x <= -VIRTUAL_MOVE_DEADZONE;
  const virtualRight = virtual.x >= VIRTUAL_MOVE_DEADZONE;
  const virtualUp = virtual.y >= VIRTUAL_MOVE_DEADZONE;
  const virtualDown = virtual.y <= -VIRTUAL_MOVE_DEADZONE;
  input.left = !!input._keyLeft || virtualLeft;
  input.right = !!input._keyRight || virtualRight;
  input.up = !!input._keyUp || virtualUp;
  input.down = !!input._keyDown || virtualDown;
}

function recomputeInteractFromSources(input: InputState): void {
  ensureInternalState(input);
  const nextInteract = !!input._keyInteract || !!input._virtualInteractDown;
  const prevInteract = !!input._interactComposedPrev;
  input.interact = nextInteract;
  if (nextInteract && !prevInteract) {
    input.interactPressed = true;
  }
  input._interactComposedPrev = nextInteract;
}

export function setVirtualMoveAxes(input: InputState, x: number, y: number, active: boolean): void {
  ensureInternalState(input);
  if (!active) {
    input._virtualMoveActive = false;
    input._virtualMoveX = 0;
    input._virtualMoveY = 0;
  } else {
    input._virtualMoveActive = true;
    input._virtualMoveX = clampUnit(x);
    input._virtualMoveY = clampUnit(y);
  }
  recomputeDirectionalFromSources(input);
}

export function setVirtualInteractDown(input: InputState, down: boolean): void {
  ensureInternalState(input);
  input._virtualInteractDown = !!down;
  recomputeInteractFromSources(input);
}

/** Create a fresh input state and register key listeners. */
export function createInputState(): InputState {
  const s: InputState = {
    moveX: 0,
    moveY: 0,
    moveMag: 0,
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    interact: false,
    interactPressed: false,
    _keyUp: false,
    _keyDown: false,
    _keyLeft: false,
    _keyRight: false,
    _keyInteract: false,
    _virtualMoveActive: false,
    _virtualMoveX: 0,
    _virtualMoveY: 0,
    _virtualInteractDown: false,
    _interactComposedPrev: false,
  };

  window.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") s._keyUp = true;
    if (e.key === "s" || e.key === "ArrowDown") s._keyDown = true;
    if (e.key === "a" || e.key === "ArrowLeft") s._keyLeft = true;
    if (e.key === "d" || e.key === "ArrowRight") s._keyRight = true;
    recomputeDirectionalFromSources(s);
    if (e.key === " ") {
      // Edge detection: only set jumpPressed if not already jumping
      if (!s.jump) s.jumpPressed = true;
      s.jump = true;
    }
    if (e.key === "e" || e.key === "E") {
      s._keyInteract = true;
      recomputeInteractFromSources(s);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "w" || e.key === "ArrowUp") s._keyUp = false;
    if (e.key === "s" || e.key === "ArrowDown") s._keyDown = false;
    if (e.key === "a" || e.key === "ArrowLeft") s._keyLeft = false;
    if (e.key === "d" || e.key === "ArrowRight") s._keyRight = false;
    recomputeDirectionalFromSources(s);
    if (e.key === " ") s.jump = false;
    if (e.key === "e" || e.key === "E") {
      s._keyInteract = false;
      recomputeInteractFromSources(s);
    }
  });

  return s;
}

/**
 * Clear per-frame edge-triggered inputs.
 * Call this at the END of each frame to reset jumpPressed.
 */
/** Clear per-frame edge flags. */
export function clearInputEdges(input: InputState) {
  input.jumpPressed = false;
  input.interactPressed = false;
}

/** Poll pointer input or aim state (placeholder for now). */
export function inputSystem(input: InputState, _canvas: HTMLCanvasElement) {
  // Compose keyboard and virtual control sources into effective inputs.
  recomputeDirectionalFromSources(input);
  recomputeInteractFromSources(input);
}
