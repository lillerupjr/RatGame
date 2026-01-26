import { World } from "../world";
import { InputState } from "./input";

export function movementSystem(w: World, input: InputState, dt: number) {
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  w.pvx = dx * w.pSpeed;
  w.pvy = dy * w.pSpeed;

  w.px += w.pvx * dt;
  w.py += w.pvy * dt;

  // Enemies chase player
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;
    const ex = w.ex[i];
    const ey = w.ey[i];
    const vx = w.px - ex;
    const vy = w.py - ey;
    const d = Math.hypot(vx, vy) || 1;
    const ux = vx / d;
    const uy = vy / d;
    w.ex[i] = ex + ux * w.eSpeed[i] * dt;
    w.ey[i] = ey + uy * w.eSpeed[i] * dt;
  }

  // Projectiles move
  // Update last aim direction from player movement (used when no enemies exist)
  const mag = Math.hypot(w.pvx, w.pvy);
  if (mag > 0.0001) {
    w.lastAimX = w.pvx / mag;
    w.lastAimY = w.pvy / mag;
  }

}
