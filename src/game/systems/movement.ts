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
  // Update last aim direction from player movement (used when no enemies exist)
  const mag = Math.hypot(w.pvx, w.pvy);
  if (mag > 0.0001) {
    w.lastAimX = w.pvx / mag;
    w.lastAimY = w.pvy / mag;
  }

  // -------------------------
  // Player sprite dir + anim (movement-based)
  // -------------------------
  type Dir8 = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

  function dirFromVec(dx: number, dy: number): Dir8 {
    // Canvas coords: +x right, +y down
    const ang = Math.atan2(dy, dx); // -pi..pi, 0=E
    // Convert to 8-way index where 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
    const idx = (Math.round(ang / (Math.PI / 4)) + 8) % 8;
    const map: Dir8[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
    return map[idx];
  }

  const moving = mag > 8; // same threshold you were using elsewhere
  if (!moving) {
    // Idle snaps to S2 (your request)
    (w as any)._plDir = "S";
    (w as any)._plFrame = 2;
    (w as any)._plAnimT = 0;
  } else {
    const dxn = w.pvx / (mag || 1);
    const dyn = w.pvy / (mag || 1);

    (w as any)._plDir = dirFromVec(dxn, dyn);

    // 1 → 2 → 3 → 2 loop (uses all 3 frames)
    const seq = [1, 2, 3, 2] as const;
    const stepSec = 0.11; // tweak later (faster = smaller)
    const t0 = ((w as any)._plAnimT ?? 0) + dt;
    (w as any)._plAnimT = t0;

    const step = Math.floor(t0 / stepSec) % seq.length;
    (w as any)._plFrame = seq[step];
  }
}
