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
  // Phase 1 (connectors migration): CONTRACT
  //
  // - walkInfo(.) is the single source of truth:
  //     * inside top-face diamond?
  //     * walkable?
  //     * integer floorH?
  // - Stairs are decorative-only (NON-walkable) until connectors exist.
  // - Logical height is integer-only:
  //     * w.activeFloorH = current tile integer floorH
  //     * w.pz         = current tile integer floorH
  // -------------------------------------------------------
  // Keep world state synced even if we don't move this frame
  let curInfo = walkInfo(w.px, w.py, KENNEY_TILE_WORLD);

  // Phase 2: continuous height (stairs ramp)
  w.pz = curInfo.z;

  // Active floor is still an integer concept (used by spawns / filtering).
  // On stairs we track the nearest integer to current z.
  w.activeFloorH =
      curInfo.kind === "STAIRS" ? (Math.floor(curInfo.z + 0.5) | 0) : (curInfo.floorH | 0);

  // Attempt move
  const nx = w.px + w.pvx * dt;
  const ny = w.py + w.pvy * dt;

  // Phase 2 movement gate:
  // - must be walkable
  // - allow same-floor moves normally
  // - allow floor transitions if STAIRS involved, as long as the z jump is small
  const MAX_STEP_Z = 1.05;

  const tryMove = (wx: number, wy: number) => {
    const nextInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD);

    if (!nextInfo.walkable) return false;

    const stairsInvolved = (curInfo.kind === "STAIRS") || (nextInfo.kind === "STAIRS");

    if (!stairsInvolved) {
      // Pure floor movement: keep same integer floor
      if (nextInfo.floorH !== curInfo.floorH) return false;
    } else {
      // Stairs movement: allow transition as long as z doesn't jump too far
      const dz = Math.abs(nextInfo.z - curInfo.z);
      if (dz > MAX_STEP_Z) return false;
    }

    // Commit WORLD position
    w.px = wx;
    w.py = wy;

    // Update LIVE tile info for subsequent checks THIS FRAME
    curInfo = nextInfo;

    // Update height + active floor
    w.pz = nextInfo.z;
    w.activeFloorH =
        nextInfo.kind === "STAIRS" ? (Math.floor(nextInfo.z + 0.5) | 0) : (nextInfo.floorH | 0);

    return true;
  };


  // 1) Try full move first (critical for entering offset stair top-faces)
  const movedDiag = tryMove(nx, ny);

  // 2) Then axis-slide if needed
  const movedX = movedDiag ? true : tryMove(nx, w.py);
  const movedY = movedDiag ? true : tryMove(w.px, ny);

  // If nothing worked, stop velocity so sprite settles
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

    // Phase 2:
    // - Enemies can traverse stairs, so we no longer hard-stop just because floorH differs.
    // - But we DO still prevent "teleport" floor jumps: only chase if player is reachable
    //   through local stepping (stairs or same floor).
    //
    // Simple rule for now:
    // - If neither enemy nor player is on STAIRS, require same floorH (prevents cross-platform weirdness).
    // - If STAIRS involved, allow.
    const playerOnStairs = (pInfo.kind === "STAIRS");
    const enemyOnStairs = (eCur.kind === "STAIRS");

    if (!playerOnStairs && !enemyOnStairs) {
      if (eCur.floorH !== playerFloorH) continue;
    }

    // Steer toward player
    const tx = w.px;
    const ty = w.py;

    const vx = tx - ex;
    const vy = ty - ey;
    const d = Math.hypot(vx, vy) || 1;
    const ux = vx / d;
    const uy = vy / d;

    const enx = ex + ux * w.eSpeed[i] * dt;
    const eny = ey + uy * w.eSpeed[i] * dt;

    const tryEnemyMove = (wx: number, wy: number) => {
      const next = walkInfo(wx, wy, KENNEY_TILE_WORLD);
      if (!next.walkable) return false;

      // Phase 2: allow stairs traversal + small z steps.
      const stairsInvolved = (eCur.kind === "STAIRS") || (next.kind === "STAIRS");
      const MAX_STEP_Z = 1.05;

      if (!stairsInvolved) {
        // Pure floor move: same integer floor only
        if (next.floorH !== eCur.floorH) return false;
      } else {
        // Stairs move: must not jump too far in one step
        const dz = Math.abs(next.z - eCur.z);
        if (dz > MAX_STEP_Z) return false;
      }

      // Commit
      w.ex[i] = wx;
      w.ey[i] = wy;

      // Update locals + current tile info for subsequent checks THIS FRAME
      ex = wx;
      ey = wy;
      eCur = next;

      // Continuous enemy z for rendering/hit logic
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
