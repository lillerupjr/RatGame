import { World } from "../world";
import { InputState } from "./input";
import { worldDeltaToScreen } from "../visual/iso";
import {isOccludedAlongSegment, walkInfo} from "../map/kenneyMap";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { canExitRoom } from "./roomChallenge";

// -------------------------------------------------------
// Jump / Gravity constants (in world units)
// -------------------------------------------------------
/** Gravity acceleration (world units per second squared). Positive = downward. */
const GRAVITY = 800;
/** Initial upward velocity when jumping. */
const JUMP_VELOCITY = 350;
/** Minimum time between jumps to prevent bunny-hopping exploits. */
const JUMP_COOLDOWN = 0.05;

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

  // -------------------------------------------------------
  // Ground height from map (stairs, converters, etc.)
  // -------------------------------------------------------
  let groundZ = curInfo.z;

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
    groundZ = baseH + step;
  }

  // -------------------------------------------------------
  // Jump physics (applies on top of map-driven ground)
  // -------------------------------------------------------
  // Initialize jump cooldown tracker
  const jumpCd = ((w as any)._jumpCooldown ?? 0) as number;
  (w as any)._jumpCooldown = Math.max(0, jumpCd - dt);

  // Check if grounded: player's feet at or below ground level
  w.isGrounded = w.pz <= groundZ + 0.01;

  // Handle jump input (edge-triggered via jumpPressed)
  if (input.jumpPressed && w.isGrounded && (w as any)._jumpCooldown <= 0) {
    w.pvz = JUMP_VELOCITY;
    w.isGrounded = false;
    (w as any)._jumpCooldown = JUMP_COOLDOWN;
  }

  // Apply gravity when airborne
  if (!w.isGrounded) {
    w.pvz -= GRAVITY * dt;
  }

  // Integrate vertical position
  const newPz = w.pz + w.pvz * dt;

  // Ground collision: land if we fall below ground
  if (newPz <= groundZ) {
    w.pz = groundZ;
    w.pvz = 0;
    w.isGrounded = true;
  } else {
    w.pz = newPz;
  }

  // Active floor is still an integer concept (used by spawns / filtering).
  // On stairs we track the nearest integer to current z.
  w.activeFloorH =
      curInfo.kind === "STAIRS" ? (Math.floor(curInfo.z + 0.5) | 0) : (curInfo.floorH | 0);

  // Attempt move
  const nx = w.px + w.pvx * dt;
  const ny = w.py + w.pvy * dt;

  const MAX_STEP_Z = 1.05;
  const T = KENNEY_TILE_WORLD;

  const tryMove = (wx: number, wy: number) => {
    const nextInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD);

    if (!nextInfo.walkable) return false;

    // Room challenge lock: prevent leaving a locked room
    const newTx = Math.floor(wx / T);
    const newTy = Math.floor(wy / T);
    if (!canExitRoom(w, newTx, newTy)) return false;

    // When airborne, allow XY movement over different floor heights
    // (we'll check ground collision when landing)
    if (!w.isGrounded) {
      // Still check that destination is walkable, but skip floor checks
      w.px = wx;
      w.py = wy;
      curInfo = nextInfo;
      // Don't update pz here - it's handled by jump physics
      w.activeFloorH =
          nextInfo.kind === "STAIRS" ? (Math.floor(nextInfo.z + 0.5) | 0) : (nextInfo.floorH | 0);
      return true;
    }

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
    // Only when grounded - jump physics handles Z when airborne
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
  // Enemies: Enhanced Pathfinding with Stuck Detection
  //
  // Features:
  // - Stuck detection: track if enemy hasn't moved meaningfully
  // - Obstacle probing: sample multiple directions to find best path
  // - Wall-hugging: when stuck, try perpendicular directions
  // - Smooth steering: gradual direction changes
  // -------------------------------------------------------
  const ez = ((w as any).ez ??= [] as number[]);
  const eStuckTime = ((w as any).eStuckTime ??= [] as number[]);
  const eLastX = ((w as any).eLastX ??= [] as number[]);
  const eLastY = ((w as any).eLastY ??= [] as number[]);
  const eAvoidDir = ((w as any).eAvoidDir ??= [] as number[]); // Avoidance angle offset

  const pInfo = walkInfo(w.px, w.py, KENNEY_TILE_WORLD);
  const playerFloorH = pInfo.floorH;

  // Constants for pathfinding
  const STUCK_THRESHOLD = 0.15;      // Time before considered stuck (seconds)
  const STUCK_DIST_THRESHOLD = 2;    // Min distance to not be stuck
  const PROBE_ANGLES = [-Math.PI/4, -Math.PI/8, 0, Math.PI/8, Math.PI/4]; // Sample directions
  const PROBE_DIST = 24;             // How far ahead to probe
  const AVOID_DECAY = 3.0;           // How fast avoidance angle decays
  const MAX_AVOID_ANGLE = Math.PI * 0.6; // Maximum avoidance turn

  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    // Initialize tracking arrays if needed
    if (eStuckTime[i] === undefined) eStuckTime[i] = 0;
    if (eLastX[i] === undefined) eLastX[i] = w.ex[i];
    if (eLastY[i] === undefined) eLastY[i] = w.ey[i];
    if (eAvoidDir[i] === undefined) eAvoidDir[i] = 0;

    // Current position
    let ex = w.ex[i];
    let ey = w.ey[i];

    // Current tile info (this MUST be updated as we move)
    let eCur = walkInfo(ex, ey, KENNEY_TILE_WORLD);
    ez[i] = eCur.z;

    const playerOnStairs = (pInfo.kind === "STAIRS");
    const enemyOnStairs = (eCur.kind === "STAIRS");

    // Floor gating (skip enemies on different floors unless stairs involved)
    if (!playerOnStairs && !enemyOnStairs) {
      if (eCur.floorH !== playerFloorH) continue;
    }

    // Calculate base direction toward player
    const tx = w.px;
    const ty = w.py;
    const vx = tx - ex;
    const vy = ty - ey;
    const distToPlayer = Math.hypot(vx, vy);
    
    // Skip if already at player
    if (distToPlayer < 1) continue;

    const baseAngle = Math.atan2(vy, vx);
    
    // Check if stuck (hasn't moved much since last frame)
    const movedDist = Math.hypot(ex - eLastX[i], ey - eLastY[i]);
    if (movedDist < STUCK_DIST_THRESHOLD * dt * 60) {
      eStuckTime[i] += dt;
    } else {
      eStuckTime[i] = Math.max(0, eStuckTime[i] - dt * 2); // Decay stuck time faster
    }
    
    // Update last position
    eLastX[i] = ex;
    eLastY[i] = ey;

    // Decay avoidance angle over time
    if (Math.abs(eAvoidDir[i]) > 0.01) {
      eAvoidDir[i] *= Math.max(0, 1 - AVOID_DECAY * dt);
    }

    // If stuck, find an alternate direction
    if (eStuckTime[i] > STUCK_THRESHOLD) {
      // Probe multiple directions to find a clear path
      let bestAngle = baseAngle;
      let bestScore = -Infinity;

      for (const probeOffset of PROBE_ANGLES) {
        // Also try the current avoidance direction
        const anglesToTry = [probeOffset, probeOffset + eAvoidDir[i]];
        
        for (const offset of anglesToTry) {
          const testAngle = baseAngle + offset;
          const probeX = ex + Math.cos(testAngle) * PROBE_DIST;
          const probeY = ey + Math.sin(testAngle) * PROBE_DIST;
          
          const probeInfo = walkInfo(probeX, probeY, KENNEY_TILE_WORLD);
          
          // Score: prefer walkable, prefer toward player, prefer less angle change
          let score = 0;
          
          if (probeInfo.walkable) {
            score += 100;
            
            // Bonus for being closer to player
            const newDistToPlayer = Math.hypot(tx - probeX, ty - probeY);
            score += (distToPlayer - newDistToPlayer) * 2;
            
            // Slight penalty for deviating from direct path
            score -= Math.abs(offset) * 10;
            
            // Check height compatibility
            const stairsInvolved = (eCur.kind === "STAIRS") || (probeInfo.kind === "STAIRS");
            if (!stairsInvolved && probeInfo.floorH !== eCur.floorH) {
              score -= 200; // Heavy penalty for floor mismatch
            }
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestAngle = testAngle;
          }
        }
      }

      // If we found a better direction, update avoidance
      const angleChange = bestAngle - baseAngle;
      if (Math.abs(angleChange) > 0.1) {
        // Clamp the avoidance angle
        eAvoidDir[i] = Math.max(-MAX_AVOID_ANGLE, Math.min(MAX_AVOID_ANGLE, angleChange));
        eStuckTime[i] = 0; // Reset stuck timer since we found a new path
      } else {
        // No good path found, try a random perpendicular direction
        if (eStuckTime[i] > STUCK_THRESHOLD * 3) {
          eAvoidDir[i] = (Math.random() > 0.5 ? 1 : -1) * Math.PI * 0.5;
          eStuckTime[i] = 0;
        }
      }
    }

    // Apply avoidance to movement direction
    const finalAngle = baseAngle + eAvoidDir[i];
    const ux = Math.cos(finalAngle);
    const uy = Math.sin(finalAngle);

    const speed = w.eSpeed[i] * dt;
    const enx = ex + ux * speed;
    const eny = ey + uy * speed;

    const tryEnemyMove = (wx: number, wy: number) => {
      const next = walkInfo(wx, wy, KENNEY_TILE_WORLD);
      if (!next.walkable) return false;

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

    // Try diagonal move first (most efficient)
    const movedDiagonal = tryEnemyMove(enx, eny);
    
    // If diagonal failed, try axis-separated sliding
    if (!movedDiagonal) {
      const enemyMovedX = tryEnemyMove(enx, ey);
      const enemyMovedY = tryEnemyMove(ex, eny);
      
      // If both axis moves failed, try perpendicular escape
      if (!enemyMovedX && !enemyMovedY) {
        // Try perpendicular directions (wall-hugging)
        const perpAngle1 = baseAngle + Math.PI / 2;
        const perpAngle2 = baseAngle - Math.PI / 2;
        
        const perpX1 = ex + Math.cos(perpAngle1) * speed * 0.7;
        const perpY1 = ey + Math.sin(perpAngle1) * speed * 0.7;
        const perpX2 = ex + Math.cos(perpAngle2) * speed * 0.7;
        const perpY2 = ey + Math.sin(perpAngle2) * speed * 0.7;
        
        // Try the perpendicular that gets us closer to player
        const dist1 = Math.hypot(tx - perpX1, ty - perpY1);
        const dist2 = Math.hypot(tx - perpX2, ty - perpY2);
        
        if (dist1 < dist2) {
          if (!tryEnemyMove(perpX1, perpY1)) {
            tryEnemyMove(perpX2, perpY2);
          }
        } else {
          if (!tryEnemyMove(perpX2, perpY2)) {
            tryEnemyMove(perpX1, perpY1);
          }
        }
      }
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

  function dirFromVec(ddx: number, ddy: number): Dir8 {
    const ang = Math.atan2(ddy, ddx); // -pi..pi, 0=E
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
