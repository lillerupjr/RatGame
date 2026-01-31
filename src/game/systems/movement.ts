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

  // -------------------------------------------------------
  // Enemies: Option B — “Always converge”
  // Fix: update current tile info between axis moves (prevents stair/edge sticking)
  // -------------------------------------------------------
  const ez = ((w as any).ez ??= [] as number[]);

  const pInfo = walkInfo(w.px, w.py, KENNEY_TILE_WORLD);
  const playerFloorH = pInfo.floorH; // or .h, both are fine

  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    // Current position
    let ex = w.ex[i];
    let ey = w.ey[i];

    // Current tile info (this MUST be updated as we move)
    let eCur = walkInfo(ex, ey, KENNEY_TILE_WORLD);
    ez[i] = eCur.z;

    // Choose steering target:
    // - same floor: go to player
    // - different floor: go to stairs tile center (you already added/find one elsewhere)
    // NOTE: keep your existing stairs-target choice; this block assumes you already compute (tx,ty).
    let tx = w.px;
    let ty = w.py;

    if (eCur.floorH !== playerFloorH && eCur.kind !== "STAIRS") {
      // If you already have a stairs target helper, keep using it here.
      // Otherwise, leave tx/ty as player for now.
      // (This patch focuses on removing "stuck", not changing targeting.)
    }

    // Steer toward target
    const vx = tx - ex;
    const vy = ty - ey;
    const d = Math.hypot(vx, vy) || 1;
    const ux = vx / d;
    const uy = vy / d;

    const enx = ex + ux * w.eSpeed[i] * dt;
    const eny = ey + uy * w.eSpeed[i] * dt;

    // Attempt one axis move, returning updated current info if move succeeds
    const tryEnemyMove = (wx: number, wy: number) => {
      const next = walkInfo(wx, wy, KENNEY_TILE_WORLD);
      if (!next.walkable) return false;

      // Same-floor unless stairs involved (BUT use CURRENT eCur, not stale!)
      const stairsInvolved = eCur.kind === "STAIRS" || next.kind === "STAIRS";
      const sameFloor = next.floorH === eCur.floorH;
      if (!stairsInvolved && !sameFloor) return false;

      // Commit
      w.ex[i] = wx;
      w.ey[i] = wy;

      // Update locals + current tile info for subsequent checks THIS FRAME
      ex = wx;
      ey = wy;
      eCur = next;

      // Update stored Z
      ez[i] = next.z;

      return true;
    };

    // Axis-separated sliding WITH live eCur updates
    tryEnemyMove(enx, ey);
    tryEnemyMove(ex, eny);
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
