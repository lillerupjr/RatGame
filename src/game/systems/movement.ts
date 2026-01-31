import { World } from "../world";
import { InputState } from "./input";
import { worldDeltaToScreen } from "../visual/iso";
import { walkInfo } from "../map/kenneyMap";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

export function movementSystem(w: World, input: InputState, dt: number) {
  // -------------------------------------------------------
  // Isometric controls (Diablo-style):
  // screen intent -> world dx/dy
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
  // Milestone B: map-authoritative walkability + floor height
  // Using walkInfo(...) so movement and height come from the same query.
  //
  // Rules:
  // - walkInfo(...).walkable gates "inside top face + not void"
  // - non-stairs tiles require same-height as current standing tile
  // - stairs tiles are allowed (height changes handled later; for now allow)
  // - w.activeFloorH and w.pz track the tile we are currently standing on
  // -------------------------------------------------------
  const cur = walkInfo(w.px, w.py, KENNEY_TILE_WORLD);

  // keep world state synced even if we don't move this frame
  w.activeFloorH = cur.h;
  w.pz = cur.h;

  // attempt move
  const nx = w.px + w.pvx * dt;
  const ny = w.py + w.pvy * dt;

  // simple axis-separated resolution (gives nice "sliding" on edges)
  const tryMove = (wx: number, wy: number) => {
    const next = walkInfo(wx, wy, KENNEY_TILE_WORLD);

    // must be inside walk mask (top-face diamond etc.)
    if (!next.walkable) return false;

    // same-floor unless stairs involved
    const stairsInvolved = cur.kind === "STAIRS" || next.kind === "STAIRS";
    const sameFloor = next.h === cur.h;

    if (!stairsInvolved && !sameFloor) return false;

    // commit WORLD position
    w.px = wx;
    w.py = wy;

    // update floor state to match the tile we occupy
    w.activeFloorH = next.h;
    w.pz = next.h;

    return true;
  };

  const movedX = tryMove(nx, w.py);
  const movedY = tryMove(w.px, ny);

  // if neither axis worked, stop velocity so sprite settles
  if (!movedX && !movedY) {
    w.pvx = 0;
    w.pvy = 0;
  }

  // -------------------------------------------------------
  // Enemies: use the same walkInfo(...) query (no duplication)
  // (still "simple" steering; floor-gating can be expanded later)
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

    const enx = ex + ux * w.eSpeed[i] * dt;
    const eny = ey + uy * w.eSpeed[i] * dt;

    // axis-separated, same as player
    const canX = walkInfo(enx, ey, KENNEY_TILE_WORLD).walkable;
    const canY = walkInfo(ex, eny, KENNEY_TILE_WORLD).walkable;

    if (canX) w.ex[i] = enx;
    if (canY) w.ey[i] = eny;

    // If neither worked, enemy just stalls against edges (fine for now)
  }

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
    const wnX = w.pvx / (mag || 1);
    const wnY = w.pvy / (mag || 1);
    const sd = worldDeltaToScreen(wnX, wnY);

    (w as any)._plDir = dirFromVec(sd.dx, sd.dy);

    const seq = [1, 2, 3, 2] as const;
    const stepSec = 0.11;
    const t0 = ((w as any)._plAnimT ?? 0) + dt;
    (w as any)._plAnimT = t0;

    const step = Math.floor(t0 / stepSec) % seq.length;
    (w as any)._plFrame = seq[step];
  }
}
