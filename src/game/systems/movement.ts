import { World } from "../world";
import { InputState } from "./input";
import { worldDeltaToScreen } from "../visual/iso";
import {isOccludedAlongSegment, walkInfo} from "../map/kenneyMap";
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


  // Keep world state synced even if we don't move this frame
  let curInfo = walkInfo(w.px, w.py, KENNEY_TILE_WORLD);


// Player Z:
// - Default: map-provided z (stairs, etc.)
// - CONVERTER: player-only smooth 0..1 ramp inside the tile toward tile.dir
  w.pz = curInfo.z;

  if ((curInfo.kind as string) === "CONVERTER") {
    const T = KENNEY_TILE_WORLD;

    // Fractions inside tile (0..1)
    const fx = (w.px - curInfo.tx * T) / T;
    const fy = (w.py - curInfo.ty * T) / T;

    const dir = (curInfo.tile.dir ?? "N") as any;

    let step = 0;
    if (dir === "N") step = 1 - fy;
    else if (dir === "S") step = fy;
    else if (dir === "W") step = 1 - fx;
    else if (dir === "E") step = fx;

// Invert ramp direction and bias by 0.1h
    step = 1 - step + 0.1;

// clamp 0..1
    if (step < 0) step = 0;
    else if (step > 1) step = 1;

    const baseH = (curInfo.tile.h | 0);
    w.pz = baseH + step;

  }


  // Active floor is still an integer concept (used by spawns / filtering).
  // On stairs we track the nearest integer to current z.
  w.activeFloorH =
      curInfo.kind === "STAIRS" ? (Math.floor(curInfo.z + 0.5) | 0) : (curInfo.floorH | 0);

  // Attempt move
  const nx = w.px + w.pvx * dt;
  const ny = w.py + w.pvy * dt;

  const MAX_STEP_Z = 1.05;

  const tryMove = (wx: number, wy: number) => {
    const nextInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD);

    if (!nextInfo.walkable) return false;

    const stairsInvolved =
        curInfo.kind === "STAIRS" ||
        nextInfo.kind === "STAIRS" ||
        (curInfo as any).isRamp ||
        (nextInfo as any).isRamp;

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
// Update player Z after commit (same converter rule as above)
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

  const ez = ((w as any).ez ??= [] as number[]);

  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    // Current position
    let ex = w.ex[i];
    let ey = w.ey[i];

    // Current tile info (this MUST be updated as we move)
    let eCur = walkInfo(ex, ey, KENNEY_TILE_WORLD);
    ez[i] = eCur.z;



    // Height-aware goal switching:
    // If player is on another floor, steer toward a nearby "connector-like" point first.
    const findBestConnectorEntryTile = (
        ex: number,
        ey: number,
        eCur: any,
        pInfo: any
    ): { gx: number; gy: number } | null => {
      // Scan in expanding rings around the enemy (world units).
      // Keep this small/cheap — it runs per-enemy per-frame.
      const RINGS = [32, 48, 64, 80, 96, 112, 128, 160, 192];
      const DIRS: Array<[number, number]> = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ];

      const pFloor = (pInfo.floorH | 0);
      const eFloor = (eCur.floorH | 0);

      let best: { gx: number; gy: number; score: number } | null = null;

      for (let r = 0; r < RINGS.length; r++) {
        const rad = RINGS[r];

        for (let k = 0; k < DIRS.length; k++) {
          const dx = DIRS[k][0];
          const dy = DIRS[k][1];

          const gx = ex + dx * rad;
          const gy = ey + dy * rad;

          const info = walkInfo(gx, gy, KENNEY_TILE_WORLD);
          if (!info.walkable) continue;

          // We want "connector-ish" points:
          // - ramp faces (isRamp) are your new real connectors
          // - converters (if present)
          // - stairs ONLY if they are ever walkable in your current build
          const isConnectorish =
              (info as any).isRamp ||
              (info.kind as any) === "CONVERTER" ||
              (info.kind as any) === "STAIRS";

          if (!isConnectorish) continue;

          // Prefer points reachable from the enemy's current floor immediately.
          // Ramp faces return continuous z; allow "near the current floor" as entry.
          const pFloor = (pInfo.floorH | 0);
          const eFloor = (eCur.floorH | 0);
          const infoFloor = (info.floorH | 0);

// Allow entry if it's close in z OR it moves us toward player's floor.
          const entryDz = Math.abs((info.z ?? info.floorH) - eCur.z);
          const movesTowardPlayerFloor =
              Math.abs(infoFloor - pFloor) < Math.abs(eFloor - pFloor);

          if (entryDz > 0.6 && !movesTowardPlayerFloor) continue;


          // Score: prefer moving toward player's floor + toward player position
          const toHere = Math.hypot(gx - ex, gy - ey);
          const toPlayer = Math.hypot(w.px - gx, w.py - gy);
          const floorPenalty = Math.abs((info.floorH | 0) - pFloor) * 120;

          const score = toHere + toPlayer + floorPenalty;

          if (!best || score < best.score) best = { gx, gy, score };
        }

        // If we found something at this ring, stop expanding (keeps behavior local & cheap)
        if (best) break;
      }

      return best ? { gx: best.gx, gy: best.gy } : null;
    };
    const pInfo = walkInfo(w.px, w.py, KENNEY_TILE_WORLD);
    const eOnOtherFloor = (eCur.floorH | 0) !== (pInfo.floorH | 0);

    let tx = w.px;
    let ty = w.py;

    if (eOnOtherFloor) {
      const g = findBestConnectorEntryTile(ex, ey, eCur, pInfo);

      if (g) {
        const ARRIVE_R = 22; // world units; tune 16..32
        const nearGoal = Math.hypot(g.gx - ex, g.gy - ey) <= ARRIVE_R;

        // Recompute current info after any movement updates above (you already keep eCur live)
        const onConnectorish =
            (eCur as any).isRamp ||
            (eCur.kind as any) === "CONVERTER" ||
            (eCur.kind as any) === "STAIRS";

        // Also consider "in the same tile" as arrival
        const gInfo = walkInfo(g.gx, g.gy, KENNEY_TILE_WORLD);
        const sameGoalTile = (eCur.tx === gInfo.tx) && (eCur.ty === gInfo.ty);

        // If we’ve arrived/entered, stop steering to the stair point and just chase player.
        if (!nearGoal && !onConnectorish && !sameGoalTile) {
          tx = g.gx;
          ty = g.gy;
        }
      }
    }


    const vx = tx - ex;
    const vy = ty - ey;
    const d = Math.hypot(vx, vy) || 1;
    const ux = vx / d;
    const uy = vy / d;

    // --- Probe-based steering (reduces “stuck on terrain”) ---
    const speed = w.eSpeed[i] ?? 0;
    const step = speed * dt;

    // Per-enemy stuck timer + turn preference (stored off-type to avoid World type edits)
    const eStuckT = ((w as any).eStuckT ??= [] as number[]);
    const eTurnSign = ((w as any).eTurnSign ??= [] as number[]); // +1 or -1
    eStuckT[i] = eStuckT[i] ?? 0;
    eTurnSign[i] = eTurnSign[i] ?? (Math.random() < 0.5 ? 1 : -1);

    const tryEnemyMove = (wx: number, wy: number) => {
      const next = walkInfo(wx, wy, KENNEY_TILE_WORLD);
      if (!next.walkable) return false;

      const stairsInvolved =
          (eCur.kind === "STAIRS") || (next.kind === "STAIRS") ||
          (eCur as any).isRamp || (next as any).isRamp ||
          (eCur.kind as any) === "CONVERTER" || (next.kind as any) === "CONVERTER";

      const MAX_STEP_Z = 1.05;

      if (!stairsInvolved) {
        // Pure floor move: same integer floor only
        if (next.floorH !== eCur.floorH) return false;
      } else {
        // Transition move: must not jump too far in one step
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

    // Helper: rotate (dx,dy) by angle
    const rot = (dx: number, dy: number, a: number) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      return { x: dx * ca - dy * sa, y: dx * sa + dy * ca };
    };

    // Desired direction to player
    const dx0 = ux;
    const dy0 = uy;

    // Candidate angles (radians). Small fan first, then wider.
    // We bias the order by eTurnSign so enemies “choose a side” when blocked (less oscillation).
    const s = eTurnSign[i];
    const ANG = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4];
    const angs = ANG.map((a) => a * s); // flip order by turn sign

    let moved = false;

    for (let k = 0; k < angs.length; k++) {
      const a = angs[k];
      const r = (a === 0) ? { x: dx0, y: dy0 } : rot(dx0, dy0, a);

      // Single intended step
      const nx = ex + r.x * step;
      const ny = ey + r.y * step;

      // Try direct first
      if (tryEnemyMove(nx, ny)) { moved = true; break; }

      // If direct fails, try axis-slide for THIS candidate (helps on tight corners)
      if (tryEnemyMove(nx, ey)) { moved = true; break; }
      if (tryEnemyMove(ex, ny)) { moved = true; break; }
    }

    if (!moved) {
      // We’re wedged. Accumulate stuck time and occasionally flip turn direction
      eStuckT[i] += dt;
      if (eStuckT[i] > 0.35) {
        eTurnSign[i] *= -1;
        eStuckT[i] = 0;
      }
    } else {
      eStuckT[i] = 0;
    }

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
