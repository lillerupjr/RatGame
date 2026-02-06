import { World, gridAtPlayer } from "../world";
import { InputState } from "./input";
import { walkInfo, worldToTile } from "../map/kenneyMap";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { Dir8 } from "../visual/playerSprites";
import { gridToWorld, worldToGrid } from "../coords/grid";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";
import {
  computeFlowField,
  queryFlowDirection,
  isFieldStale,
  type FlowField,
} from "../map/flowField";

type GridPos = { gx: number; gy: number };
type WorldPos = { wx: number; wy: number };

function gridFromAnchor(gxi: number, gyi: number, gox: number, goy: number): GridPos {
  return { gx: gxi + gox, gy: gyi + goy };
}

function setAnchorFromWorld(
  tileWorld: number,
  wx: number,
  wy: number
): { gxi: number; gyi: number; gox: number; goy: number } {
  const gp = worldToGrid(wx, wy, tileWorld);
  const gxi = Math.floor(gp.gx);
  const gyi = Math.floor(gp.gy);
  return { gxi, gyi, gox: gp.gx - gxi, goy: gp.gy - gyi };
}

function gridDirToWorldDir(tileWorld: number, dx: number, dy: number): WorldPos {
  const w = gridToWorld(dx, dy, tileWorld);
  const len = Math.hypot(w.wx, w.wy);
  if (len <= 1e-6) return { wx: 0, wy: 0 };
  return { wx: w.wx / len, wy: w.wy / len };
}

function dirFromGrid(dx: number, dy: number): Dir8 {
  const ang = Math.atan2(dy, dx);
  const idx = (Math.round(ang / (Math.PI / 4)) + 8) % 8;
  const map: Dir8[] = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
  return map[idx];
}

let _cachedField: FlowField | null = null;

/** Update player/enemy movement, steering, and facing. */
export function movementSystem(w: World, input: InputState, dt: number) {
  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  let px = pWorld.wx;
  let py = pWorld.wy;

  // Screen-aligned input: north = +gy, east = +gx.
  let gx = 0;
  let gy = 0;
  if (input.left) gx -= 1;
  if (input.right) gx += 1;
  if (input.up) gy += 1;
  if (input.down) gy -= 1;

  let gdx = gx;
  let gdy = gy;
  const glen = Math.hypot(gdx, gdy);
  if (glen > 1e-6) {
    gdx /= glen;
    gdy /= glen;
  }

  const worldDir = gridDirToWorldDir(KENNEY_TILE_WORLD, gdx, gdy);
  w.pvx = worldDir.wx * w.pSpeed;
  w.pvy = worldDir.wy * w.pSpeed;

  let curInfo = walkInfo(px, py, KENNEY_TILE_WORLD, w.pz);

  w.pz = curInfo.z;
  w.pzVisual = curInfo.zVisual;
  w.pzLogical = curInfo.zLogical;
  w.activeFloorH =
    curInfo.kind === "STAIRS" ? (Math.floor(curInfo.z + 0.5) | 0) : (curInfo.floorH | 0);

  const nx = px + w.pvx * dt;
  const ny = py + w.pvy * dt;
  const MAX_STEP_Z = 1.05;

  const tryMove = (wx: number, wy: number) => {
    const nextInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD, curInfo.z);
    if (!nextInfo.walkable) return false;

    const stairsInvolved =
      curInfo.kind === "STAIRS" ||
      nextInfo.kind === "STAIRS" ||
      (curInfo as any).isRamp ||
      (nextInfo as any).isRamp;

    if (!stairsInvolved) {
      if (nextInfo.floorH !== curInfo.floorH) return false;
    } else {
      const dz = Math.abs(nextInfo.z - curInfo.z);
      if (dz > MAX_STEP_Z) return false;
    }

    const anchor = setAnchorFromWorld(KENNEY_TILE_WORLD, wx, wy);
    w.pgxi = anchor.gxi;
    w.pgyi = anchor.gyi;
    w.pgox = anchor.gox;
    w.pgoy = anchor.goy;

    const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
    px = pw.wx;
    py = pw.wy;

    curInfo = nextInfo;
    w.pz = nextInfo.z;
    w.pzVisual = nextInfo.zVisual;
    w.pzLogical = nextInfo.zLogical;
    w.activeFloorH =
      nextInfo.kind === "STAIRS" ? (Math.floor(nextInfo.z + 0.5) | 0) : (nextInfo.floorH | 0);
    return true;
  };

  const movedDiag = tryMove(nx, ny);
  const movedX = movedDiag ? true : tryMove(nx, py);
  const movedY = movedDiag ? true : tryMove(px, ny);

  if (!movedX && !movedY) {
    w.pvx = 0;
    w.pvy = 0;
  }

  const ezVisual = w.ezVisual;
  const ezLogical = w.ezLogical;
  const pInfo = walkInfo(px, py, KENNEY_TILE_WORLD, w.pzVisual);
  const playerFloorH = pInfo.floorH;

  // Compute / refresh flow field for enemy pathfinding
  const playerTile = worldToTile(px, py, KENNEY_TILE_WORLD);
  if (isFieldStale(_cachedField, playerTile.tx, playerTile.ty, playerFloorH)) {
    _cachedField = computeFlowField(px, py, playerFloorH, KENNEY_TILE_WORLD);
  }
  const flowField = _cachedField!;

  const playerGrid = gridAtPlayer(w);

  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;

    const eWorld = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
    let ex = eWorld.wx;
    let ey = eWorld.wy;

    let eCur = walkInfo(ex, ey, KENNEY_TILE_WORLD, ezVisual?.[i]);
    ezVisual[i] = eCur.zVisual;
    ezLogical[i] = eCur.zLogical;

    // Query flow field for optimal direction toward player
    const flowDir = queryFlowDirection(flowField, ex, ey, eCur.floorH, KENNEY_TILE_WORLD);

    let gux: number;
    let guy: number;
    if (flowDir) {
      gux = flowDir.dx;
      guy = flowDir.dy;
    } else {
      // Fallback: direct chase for off-graph or unreachable enemies
      const enemyGrid = gridFromAnchor(w.egxi[i], w.egyi[i], w.egox[i], w.egoy[i]);
      const gvx = playerGrid.gx - enemyGrid.gx;
      const gvy = playerGrid.gy - enemyGrid.gy;
      const gdist = Math.hypot(gvx, gvy) || 1;
      gux = gvx / gdist;
      guy = gvy / gdist;
    }

    const eWorldDir = gridDirToWorldDir(KENNEY_TILE_WORLD, gux, guy);
    const enx = ex + eWorldDir.wx * w.eSpeed[i] * dt;
    const eny = ey + eWorldDir.wy * w.eSpeed[i] * dt;

    const tryEnemyMove = (wx: number, wy: number) => {
      const next = walkInfo(wx, wy, KENNEY_TILE_WORLD, eCur.z);
      if (!next.walkable) return false;

      const stairsInvolved =
        eCur.kind === "STAIRS" ||
        next.kind === "STAIRS" ||
        (eCur as any).isRamp ||
        (next as any).isRamp;
      const MAX_STEP_Z_LOCAL = 1.05;

      if (!stairsInvolved) {
        if (next.floorH !== eCur.floorH) return false;
      } else {
        const dz = Math.abs(next.z - eCur.z);
        if (dz > MAX_STEP_Z_LOCAL) return false;
      }

      const anchor = setAnchorFromWorld(KENNEY_TILE_WORLD, wx, wy);
      w.egxi[i] = anchor.gxi;
      w.egyi[i] = anchor.gyi;
      w.egox[i] = anchor.gox;
      w.egoy[i] = anchor.goy;

      const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
      ex = ew.wx;
      ey = ew.wy;
      eCur = next;
      ezVisual[i] = next.zVisual;
      ezLogical[i] = next.zLogical;
      return true;
    };

    tryEnemyMove(enx, ey);
    tryEnemyMove(ex, eny);
  }

  const mag = Math.hypot(gdx, gdy);
  if (mag > 0.0001) {
    w.lastAimX = gdx / mag;
    w.lastAimY = gdy / mag;
  }

  const moving = glen > 0.0001;
  if (!moving) {
    (w as any)._plDir = "S";
    (w as any)._plFrame = 2;
    (w as any)._plAnimT = 0;
  } else {
    (w as any)._plDir = dirFromGrid(gdx, gdy);

    const seq = [1, 2, 3, 2] as const;
    const stepSec = 0.11;
    const t0 = ((w as any)._plAnimT ?? 0) + dt;
    (w as any)._plAnimT = t0;

    const step = Math.floor(t0 / stepSec) % seq.length;
    (w as any)._plFrame = seq[step];
  }
}
