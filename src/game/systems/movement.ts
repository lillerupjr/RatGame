import { World } from "../world";
import { InputState } from "./input";
import { worldDeltaToScreen } from "../visual/iso";
import { walkInfo, heightAtWorld } from "../map/kenneyMap";
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
  // Milestone B + stairs Z:
  // - walkInfo(...) drives walkability + integer height level (h)
  // - heightAtWorld(...) drives continuous Z (float) for stairs
  //
  // Rules:
  // - must be walkable (inside top-face + not void)
  // - non-stairs tiles require same integer floor height
  // - stairs tiles are allowed (and may change floor height)
  // - w.activeFloorH tracks integer floor level
  // - w.pz tracks continuous Z (smooth on stairs)
  // -------------------------------------------------------
  const curInfo = walkInfo(w.px, w.py, KENNEY_TILE_WORLD);

// Integer "floor level" for gating/active floor
  const curFloorH = curInfo.floorH;

// Keep world state synced even if we don't move this frame
  w.activeFloorH = curFloorH;
  w.pz = curInfo.z;


  // Attempt move
  const nx = w.px + w.pvx * dt;
  const ny = w.py + w.pvy * dt;

  // Simple axis-separated resolution (gives nice "sliding" on edges)
  const tryMove = (wx: number, wy: number) => {
    const nextInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD);

    // Must be inside walk mask (top-face diamond etc.)
    if (!nextInfo.walkable) return false;

// Integer floor height for gating
    const nextFloorH = nextInfo.floorH;

    // Same-floor unless stairs involved
    const stairsInvolved = curInfo.kind === "STAIRS" || nextInfo.kind === "STAIRS";
    const sameFloor = nextFloorH === curFloorH;

    if (!stairsInvolved && !sameFloor) return false;

    // Commit WORLD position
    w.px = wx;
    w.py = wy;

    // Update floor state to match the tile we occupy (integer)
    w.activeFloorH = nextFloorH;

    // Continuous Z for smooth stair traversal + render lift
    w.pz = nextInfo.z;

    return true;

  };

  const movedX = tryMove(nx, w.py);
  const movedY = tryMove(w.px, ny);

  // If neither axis worked, stop velocity so sprite settles
  if (!movedX && !movedY) {
    w.pvx = 0;
    w.pvy = 0;
  }

  // -------------------------------------------------------
  // Enemies: single-query Z + (optional) floor gating
  //
  // - Store continuous z for enemies in (w as any).ez[i]
  // - Enforce same-floor movement like player:
  //     * can move within same integer floorH
  //     * stairs allow transition
  // - Additionally, keep enemies on the active floor (prevents cross-platform weirdness)
  //   If your spawn system already enforces this, this becomes a safety net.
  // -------------------------------------------------------

  // Lazily allocate enemy Z buffer without changing World type
  const ez = ((w as any).ez ??= [] as number[]);

  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const ex = w.ex[i];
    const ey = w.ey[i];

    // Current enemy tile info (walk + floor + z)
    const eCur = walkInfo(ex, ey, KENNEY_TILE_WORLD);
    ez[i] = eCur.z;

    const eCurFloorH = eCur.floorH;

    // Simple steering toward player
    const vx = w.px - ex;
    const vy = w.py - ey;
    const d = Math.hypot(vx, vy) || 1;
    const ux = vx / d;
    const uy = vy / d;

    const enx = ex + ux * w.eSpeed[i] * dt;
    const eny = ey + uy * w.eSpeed[i] * dt;

    const tryEnemyMove = (wx: number, wy: number) => {
      const eNext = walkInfo(wx, wy, KENNEY_TILE_WORLD);
      if (!eNext.walkable) return false;

      // Same-floor unless stairs involved
      const stairsInvolved = eCur.kind === "STAIRS" || eNext.kind === "STAIRS";
      const sameFloor = eNext.floorH === eCurFloorH;
      if (!stairsInvolved && !sameFloor) return false;

      // No player-floor gating: enemies can move on their own floor.
      // (They are still prevented from "stepping" between floors unless on STAIRS.)

      // Commit position
      w.ex[i] = wx;
      w.ey[i] = wy;

      // Update stored Z
      ez[i] = eNext.z;
      return true;
    };

    // Axis-separated movement (sliding)
    tryEnemyMove(enx, ey);
    tryEnemyMove(w.ex[i], eny);

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
