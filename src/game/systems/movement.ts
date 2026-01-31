// src/game/systems/movement.ts
import { World } from "../world";
import { InputState } from "./input";
import { worldDeltaToScreen } from "../visual/iso";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { moveCircleWithTileCollision } from "../map/tileCollision";

export function movementSystem(w: World, input: InputState, dt: number) {
  // -------------------------------------------------------
  // Isometric controls (Diablo-style):
  // WASD/Arrows map to SCREEN directions, then convert to WORLD.
  //
  // sx = x - y
  // sy = x + y
  // => x = (sx + sy)/2
  //    y = (sy - sx)/2
  // -------------------------------------------------------
  let sx = 0;
  let sy = 0;
  if (input.left) sx -= 1;
  if (input.right) sx += 1;
  if (input.up) sy -= 1;
  if (input.down) sy += 1;

  let dx = (sx + sy) * 0.5;
  let dy = (sy - sx) * 0.5;

  const len = Math.hypot(dx, dy);
  if (len > 1e-6) {
    dx /= len;
    dy /= len;
  }

  w.pvx = dx * w.pSpeed;
  w.pvy = dy * w.pSpeed;

  // -------------------------------------------------------
  // Tile collision (revamped):
  // Use a feet-circle radius rather than a single point.
  //
  // Important: playerR is used for combat collisions too.
  // For "feet", we usually want slightly smaller than sprite/combat radius.
  // Tune this ratio to taste.
  // -------------------------------------------------------
  const feetR = Math.max(6, w.playerR * 0.65);

  const oldX = w.px;
  const oldY = w.py;

  const stepX = w.pvx * dt;
  const stepY = w.pvy * dt;

  const moved = moveCircleWithTileCollision(
      oldX,
      oldY,
      stepX,
      stepY,
      feetR,
      KENNEY_TILE_WORLD
  );

  w.px = moved.x;
  w.py = moved.y;

  // -------------------------------------------------------
  // Enemies chase player, BUT ALSO respect tile collision.
  // This prevents them walking through holes and keeps encounters fair.
  // You can later special-case flying enemies, etc.
  // -------------------------------------------------------
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const ex = w.ex[i];
    const ey = w.ey[i];

    const vx = w.px - ex;
    const vy = w.py - ey;
    const d = Math.hypot(vx, vy) || 1;

    const ux = vx / d;
    const uy = vy / d;

    const eStepX = ux * w.eSpeed[i] * dt;
    const eStepY = uy * w.eSpeed[i] * dt;

    // Enemy "feet radius": slightly smaller than their combat radius.
    const eFeetR = Math.max(4, w.eR[i] * 0.65);

    const em = moveCircleWithTileCollision(
        ex,
        ey,
        eStepX,
        eStepY,
        eFeetR,
        KENNEY_TILE_WORLD
    );

    w.ex[i] = em.x;
    w.ey[i] = em.y;
  }

  // Update last aim direction from player movement (used when no enemies exist)
  const mag = Math.hypot(w.pvx, w.pvy);
  if (mag > 0.0001) {
    w.lastAimX = w.pvx / mag;
    w.lastAimY = w.pvy / mag;
  }

  // -------------------------
  // Player sprite dir + anim (movement-based)
  // In iso: compute facing from SCREEN-projected velocity,
  // so the sprite faces the direction it appears to move.
  // -------------------------
  type Dir8 = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

  function dirFromVec(dx: number, dy: number): Dir8 {
    // Canvas coords: +x right, +y down
    const ang = Math.atan2(dy, dx); // -pi..pi, 0=E
    const idx = (Math.round(ang / (Math.PI / 4)) + 8) % 8;
    const map: Dir8[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
    return map[idx];
  }

  const moving = mag > 8;
  if (!moving) {
    (w as any)._plDir = "S";
    (w as any)._plFrame = 2;
    (w as any)._plAnimT = 0;
  } else {
    // Project movement into screen space for facing
    const wnX = w.pvx / (mag || 1);
    const wnY = w.pvy / (mag || 1);
    const sd = worldDeltaToScreen(wnX, wnY);

    (w as any)._plDir = dirFromVec(sd.dx, sd.dy);

    // 1 → 2 → 3 → 2 loop
    const seq = [1, 2, 3, 2] as const;
    const stepSec = 0.11;
    const t0 = ((w as any)._plAnimT ?? 0) + dt;
    (w as any)._plAnimT = t0;

    const step = Math.floor(t0 / stepSec) % seq.length;
    (w as any)._plFrame = seq[step];
  }
}
